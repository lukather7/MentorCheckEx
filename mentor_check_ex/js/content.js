"use strict";

/* ----------------------------------------------------------------------- */
/* Variables
-------------------------------------------------------------------------- */
// クラス
const ME = new MentorCheckEx();
const ME2 = new MentorCheckEx();

// 設定
let interval = 30;         // リロード間隔
let chime = false;         // チャイム有無
let isNotify = false;         // 通知有無
let smartIfSimple = false; // 詳細画面割愛
let new_version = false;   // 新しいバージョンの有無

// テスト用にプラグイン環境に依存する部分をなくす
const $chrome = (typeof _chrome === 'undefined') ? chrome : _chrome;
const $review = (typeof review  === 'undefined') ? '/mentor/all/reports' : review;

// チャイムの準備
const audio = new Audio($chrome.runtime.getURL("resources/chime.mp3"));
audio.volume = 0.5; // ボリュームは半分

// タイマー用ハンドル
let handle = 0;
// 変更判断
let save_time = '9999/99/99 99:99:99';
// もともとのタイトル
const title = document.title;
/* ----------------------------------------------------------------------- */

const createMenuElement = () =>
  MCEElement.create('li').addClass('sidemenu-li').addClass('mentorChangeEx');

const createSwitchElement = (num, text) => {
  const li = createMenuElement().appendChild(
    MCEElement.create('div').addClass('pluginSwitchArea').appendChild(
      MCEElement.create('input').prop({ id: 'pluginSwitchButton' + num, type: 'checkbox', })
    ).appendChild(
      MCEElement.create('label').prop({ htmlFor: 'pluginSwitchButton' + num }).appendChild(
        MCEElement.create('span')
      )
    )
    .appendChild(
      MCEElement.create('div').addClass('swImg'))
    )
    .appendChild(
      MCEElement.create('span').prop({ style: { color: 'white' } }).text(text)
    );
  return li;
}

const formatedTime = () => {
  const now = new Date;
  return  ('0' + now.getHours()).slice(-2) + ':' +
          ('0' + now.getMinutes()).slice(-2) + ':' +
          ('0' + now.getSeconds()).slice(-2);
};

const checkSimple = () => {
  const ele = ME.queryId('pluginSwitchButton2');
  return ele ? ele.checked : false;
};
// シンプル化する
const getChallengesAndSimplify = simple => {
  const t = ME.queryAll('.container-fluid .row .col-lg-12 table tr td:first-of-type a');

  // パンくず非表示＆ナビゲーションタブ＆タイトル部分のマージン削除
  MCEElement.create(ME.query('ol.breadcrumb'           )).style({display: simple ? 'none' : ''});
  MCEElement.create(ME.query('ul.nav-tabs'             )).style({display: simple ? 'none' : ''});
  MCEElement.create(ME.query('#page-content-wrapper h2')).style({padding: simple ? '0' : ''});
  
  t.forEach(e => {
    const el = MCEElement.create(e);
    const h = el.prop('href');
    el.prop('target', '_blank');

    if (simple && smartIfSimple) {
      el.prop({
        dataset: { method: 'post' },
        href: h + '/start_review',
      })
      .text('開始')
    }
    else {
      if (h.indexOf('/start_review') > 0) {
        const hh = h.replace('/start_review', '');
        el.prop({
          dataset: { method: '' },
          href: hh,
        })
        .text('詳細')
      }
    }
  });
  // 課題レビュー待ち受けに必要なさそうなカラムを非表示する
  [4, 6, 7, 9].forEach(i => {
    ME.queryAll('table tr th:nth-of-type(' + i + '),table tr td:nth-of-type(' + i + ')')
      .forEach(e => {
        e.style.display = simple ? 'none' : '';
      });
  });
};
// navバーを反転させる0.5秒後にPromiseを返す
const emphasisBlink = () => {
  const style = ME.query('.navbar.navbar-fixed-top').style;
  style.backgroundColor = (style.backgroundColor) ? "" : "#cb3333";
  style.borderColor = (style.borderColor) ? "" : "#cb3333";

  return new Promise(resolve => {
    setTimeout(() => {
      resolve('timeout');
    }, 500);
  });
}
// navバーを点滅させる
const notify = async () => {
  for (let i = 0; i < 6; i++) {
    await emphasisBlink();
  }
};

// HTML中のタイトルを変更
const changeTitle = () => {
  if (location.href.indexOf('[]') > 0) {
    ME.query('.container-fluid h2').innerText = '複数コースのレビュー一覧';
    ME.queryId('courseDropdown').innerText = '複数コース選択中';
  }
  else {
    ME.query('.container-fluid h2').innerText = ME.query('#courseDropdown').innerText + 'レビュー一覧';
  }
};

const reloadFunc = async () => {
  // リロードスイッチがONなら
  if (ME.queryId('pluginSwitchButton1').checked) {
    fetch(location.href, { method: 'GET', mode: 'same-origin', credentials: 'include' })
      .then(response => {
        if (!response.ok) {
          throw new Error("HTTP error! status: " + response.status);
        }
        return response.text();
      })
      .then(text => {
        const doc = document.implementation.createHTMLDocument("").documentElement;
        doc.innerHTML = text;

        var s = '#page-content-wrapper';
        const element = ME2.set_document(doc).query(s);
        const target = ME.query(s);
        if (element) {
          target.outerHTML = element.outerHTML;
        }
        // 最新のレビュー提出時間を取得する
        // 「すべてのレビュー」と「レビュー待ち」でレビューの順序が違うので、最大を取得する。
        let time = "";
        ME2.queryAll('#page-content-wrapper table tr td:nth-of-type(8)').forEach(el => {
          time = time < el.innerText ? el.innerText : time;
        });

        getChallengesAndSimplify(checkSimple())

        if ((!save_time && time) || save_time && time && save_time < time) {
          // チャイムの有無スイッチがONなら
          if (ME.queryId('pluginSwitchButton4').checked) {
            audio.play();
          }
          // 通知の有無スイッチがONなら
          if (ME.queryId('pluginSwitchButton5').checked) {
            MentorCheckEx.notify('課題レビュー', '更新があります。');
            document.title = '!!変更あり!! ' + title;
            notify();
          }
          console.info('A change has been detected. ' + formatedTime());
        }
        else {
          document.title = '監視中... ' + title;
        }

        save_time = time;
        ME.queryId('pluginSwitchMessage').innerText = '更新：' + formatedTime();
        
        changeTitle();
      })
      .catch(err => {
        throw err;
      });
  }
};

// プルダウンリストから自分の受け持ちコースを取得する
const makeCourseList = () => {
  const a_list = ME.queryAll('#page-content-wrapper .dropdown .dropdown-menu li a');
  const course_list = [];
  for (let i = 1; i < a_list.length; i++) {
    let search;
    [, search] = a_list[i].search.split('=');

    const setting = ME.settings.course_list.find(e => e.id == search);
    const visible = !!(!setting || !('visible' in setting) || setting.visible);

    course_list.push({ id: search, name: a_list[i].innerText, visible });
  }
  $chrome.storage.local.set({ course_list: course_list });
};

/* これ以降初期化部分
-------------------------------------------------------------------------- */
const init = async () => {
  // サイドバーの最後の要素の下に線を引く
  MCEElement.create(ME.query('#sidebar-wrapper ul:last-child')).addClass('u-border');
  // 新たにサイドバーの要素を追加する
  const sidebarNavMenter = MCEElement.create('ul').addClass('sidebar-nav-mentor');
  MCEElement.create(ME.query('#sidebar-wrapper')).appendChild(sidebarNavMenter);
  sidebarNavMenter.appendChild(
    MCEElement.create('h5').text('Plugin').addClass(['font-size-x-small', 'add-margin-0', 'add-padding-10', 'font-color-gray-lighter'])
  );

  if (ME.settings.watchSlack) {
    // Slack通知用ページのリンク
    sidebarNavMenter.appendChild(
      createMenuElement().appendChild(
        MCEElement.create('a')
          .prop({ href: '/mentor/all/reports?custom=1', target: '_blank' }).addClass(['side-link', 'sidebar-icon'])
          .appendChild(
            MCEElement.create('i')
              .addClass(['fa', 'fa-external-link', 'font-color-white', 'add-padding-right-15'])
              .appendChild(
                MCEElement.create('span').addClass(['add-padding-left-15', 'display-inline-block']).text('Slack通知用ページ')
              )
          )
      )
    );
  }

  // シンプル化が出来るのは「レビュー待ち」のみ。
  if (location.pathname == $review) {
    // 「シンプル化」スイッチの生成
    const li2 = createSwitchElement(2, '　シンプル化');
    li2.addEventListener('change', e => {
      getChallengesAndSimplify(e.target.checked);
    });
    sidebarNavMenter.appendChild(li2);
  }

  // プルダウンリストから自分の受け持ちコースを取得する
  makeCourseList();

  // 「チャイム」スイッチの生成
  const li4 = createSwitchElement(4, '　チャイム');
  sidebarNavMenter.appendChild(li4);
  ME.queryId('pluginSwitchButton4').checked = chime;

  // 「通知」スイッチの生成
  const li5 = createSwitchElement(5, '　通知');
  sidebarNavMenter.appendChild(li5);
  ME.queryId('pluginSwitchButton5').checked = isNotify;
  
  // 「定期リロード」スイッチの生成
  const li1 = createSwitchElement(1, '　定期リロード');
  sidebarNavMenter.appendChild(li1);
  // 「定期リロード」の変更イベント
  li1.addEventListener('change', e => {
    if (e.target.checked) {
      reloadFunc();
      handle = setInterval(reloadFunc, interval * 1000);
    }
    else {
      ME.queryId('pluginSwitchMessage').innerHTML = '&nbsp;';
      clearInterval(handle);
      handle = 0;
      document.title = title;
    }
  });

  // 更新時間表示場所生成
  const li3 = createMenuElement().appendChild(
    MCEElement.create('span')
      .prop({ id: 'pluginSwitchMessage', style: { color: 'white' } })
      .text('　')
  )
  sidebarNavMenter.appendChild(li3);

  if (new_version) {
    const li6 = createMenuElement().appendChild(
      MCEElement.create('a')
      .prop({ id: 'pluginVersionUpMessage', href: 'https://github.com/ShigeUe/MentorCheckEx' })
      .text('MentorCheckExの\n新バージョンあり')
    )
    sidebarNavMenter.appendChild(li6);
  }

  getChallengesAndSimplify(false);
  changeTitle();
};

// 設定の取得
(async () => {
  await ME.getSettings();
  interval      = ME.settings.interval <= 30 ? 30 : ME.settings.interval;
  chime         = ME.settings.chime;
  isNotify      = ME.settings.notify;
  smartIfSimple = ME.settings.smartIfSimple;
  new_version   = ME.settings.new_version;
  audio.volume  = ME.settings.volume * 0.01;
  // 初期化の実行
  await init();
})();
