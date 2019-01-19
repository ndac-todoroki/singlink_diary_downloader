var showdown = require('showdown');
var JSZip = require("jszip");
var sanitize = require("sanitize-filename");

; (function ($, undefined) {
  var converter = new showdown.Converter();
  var zip = new JSZip();

  // 日記一覧のスクレイピング
  var scraper = {

    // 日記一覧全ページをiterate
    iterator: 'tr td.bg_02:has(div) > div > a:contains("もっと読む")',

    // 念の為「もっと読む」でフィルタできるようにもしておく
    data: {
      // もっと読む
      title: { sel: '' },

      // URL
      url: { sel: '', attr: 'href' }
    }
  };

  // 再帰的に次の一覧ページをとってくる
  function nextUrl($page) {
    return $page.find('tbody > tr:nth-child(1) > td:nth-child(1) > div:nth-child(1) > a.link:contains("次へ")')
      .attr('href');
  }

  // 最初にいるページをとりあえずパースする
  artoo.log.debug('Starting the scraper...');
  // OKを押さないと進まない
  alert("ダウンロードを開始します．時間がかかりますが，再度のクリックはしないでください(2回ダウンロードすることになります)");

  var frontpage = artoo.scrape(scraper);

  // Then we launch the ajax spider
  artoo.ajaxSpider(

    // This function is an iterator that returns the next page url
    // It stops the spider if it returns false, else you'll need a limit param
    function (i, $data) {
      return nextUrl(!i ? $(document) : $data);
    },

    // This is a configuration object passed to the spider
    {

      // 万が一に備え，500ページで止まる
      limit: 500,

      // We want to scrape the HTML retrieved by ajax
      scrape: scraper,

      // We want to concat new elements in the spider's accumulator so we have
      // a flat list at the end
      concat: true,

      // This is the final callback of the spider
      // We tell the user that the wait is over and we download the data
      done: function (data) {
        artoo.log.debug('Finished getting URLs. Parsing goes on...');
        diary_urls =
          frontpage.concat(data).map(
            function (obj) {
              return (new URL(obj["url"] + "&page=1&page_size=100", document.location.origin)).href;
            }
          );

        // 前のURL前取得が成功したら，それらのURLで今度は日記のパース

        // 日記のスクレイピング
        var inner_scraper = {
          // body だと何故かダメらしい
          iterator: 'td.right_content_540',
          data: {
            author: { sel: 'span#DOM_fh_diary_writer' },
            date: { sel: 'table.border_01 > tbody > tr > td:has(div:has(a:has(img.pict))) > div' },
            title: { sel: 'span#DOM_fh_diary_title' },
            publicity: { sel: 'table.border_01 > tbody > tr > td.bg_02 > div', method: 'html' },
            body: { sel: 'div#DOM_fh_diary_body', method: 'html' },
            likes: {
              sel: 'table.border_01 > tbody > tr > td > div > form',
              method: function ($) { return $(this).text().replace(/\n/g, ""); }
            },
            comments: {
              sel: 'table#DOM_fh_diary_comments',
              method: function ($) {
                var dates =
                  $(this)
                    .find('td.bg_05.border_01 > div:has(input.no_bg[name="target_c_diary_comment_id[]"])')
                    .map(function () { return $(this).text(); })
                    .get();
                var names =
                  $(this)
                    .find('span.DOM_fh_diary_comment_writer')
                    .map(function () { return $(this).text(); })
                    .get();
                var bodies =
                  $(this)
                    .find('div.DOM_fh_diary_comment_body')
                    .map(function () { return $(this).html(); })
                    .get();

                var comments = [];
                for (var i = 0; i < bodies.length; i++) {
                  comments.push(
                    {
                      index: i + 1,
                      date: dates[i],
                      name: names[i],
                      body: bodies[i]
                    }
                  )
                }

                return comments;
              }
            }
          }
        }

        // Then we launch the ajax spider
        artoo.ajaxSpider(

          // 日記URL一覧
          diary_urls,

          // This is a configuration object passed to the spider
          {

            // diary_urlが有限なのでリミットなし
            // limit: 10,

            // We want to scrape the HTML retrieved by ajax
            scrape: inner_scraper,

            // We want to concat new elements in the spider's accumulator so we have
            // a flat list at the end
            concat: true,

            // This is the final callback of the spider
            // We tell the user that the wait is over and we download the data
            done: function (data) {
              artoo.log.debug('Finished retrieving data. Downloading...');

              zip.file("data.json", JSON.stringify(data, null, 4));
              diaries_dir = zip.folder("diaries");

              data.map(
                function (diary, index, arr) {
                  return {
                    date: diary.date,
                    title: diary.title,
                    body: "#" + diary.title + "\n" +
                      "\n" +
                      diary.date + "\n" +
                      diary.publicity + "\n" +
                      diary.likes + "\n" +
                      "\n" +
                      "## 本文 \n" +
                      "\n" +
                      $("<div>").html(converter.makeMarkdown(diary.body)).text() + "\n" +
                      "\n" +
                      "\n" +
                      "## コメント \n" +
                      diary.comments.map(
                        function (comment, i, cs) {
                          return (
                            "##### " + comment.index + " " + comment.name + " (" + comment.date + ")\n" +
                            $("<div>").html(converter.makeMarkdown(comment.body)).text() + "\n" +
                            "\n"
                          );
                        }
                      ).join("\n")
                  }
                }
              )
                .forEach(
                  function (diary, _index, _all) {
                    diaries_dir.file(sanitize(diary.date + " - " + diary.title + ".md", "_"), diary.body);
                  }
                );
              zip.generateAsync({ type: "blob" })
                .then(function (blob) {
                  artoo.save(blob, "singlink.zip");
                });
            }
          }
        );
      }
    }
  );
}).call(this, artoo.$);
