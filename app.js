const Parser = require("rss-parser");
const parser = new Parser();
const yaml = require("js-yaml");
const fs = require("fs");
const axios = require("axios").default;
const { solr, dbconfig } = yaml.load(fs.readFileSync("config.yaml", "utf-8"));
const mysql = require("mysql2/promise");
const md5 = require("md5");

(async () => {
  const pool = mysql.createPool(dbconfig);
  try {
    solrquery = `http://${solr.host}:${solr.port}/solr/${solr.core}/tag?overlaps=NO_SUB&tagsLimit=5000&fl=id,name,countrycode&wt=json&indent=on`;
    conn = await pool.getConnection();
    const rss = await conn
      .query("SELECT * FROM rss_source")
      .then((res) => res[0]);
    conn.release();
    console.debug(rss);
    // return;
    await Promise.all(
      rss.map(async (src) => {
        let { id, url, last_hash } = src;
        let feed = await parser.parseURL(url).catch((e) => {
          console.error(e);
        });

        if (feed == undefined) return;

        conn = await pool.getConnection();
        for (let item of feed.items) {
          if (!!last_hash && last_hash == md5(item.link)) break;
          await axios
            .post(solrquery, item.contentSnippet, {
              headers: { "Content-Type": "text/plain" },
            })
            .then(async (res) => {
              let { numFound, docs } = res.data.response;
              // res.data.response: {numFound: 1, start: 0, numFoundExact: true, docs: Array(1)}
              if (numFound > 0) {
                tag = docs.map(({ id }) => id);
                let topic = newTopic(item, tag);
                console.debug(topic);
                await conn
                  .query("INSERT INTO push_queue SET ?", newTopic(item, tag))
                  .catch((e) => console.error(e));
                await conn.commit();
              }
            })
            .catch((e) => {
              console.error(e);
            });
          // title
          // link
          // contentSnippet
          // isoDate
          console.debug(item);
        }
        // conn = await pool.getConnection();
        await conn
          .query("UPDATE rss_source SET last_hash = ? WHERE id = ?", [
            md5(feed.items[0].link),
            id,
          ])
          .catch(async (err) => {
            console.error(err);
            await conn.rollback();
          });
        await conn.commit();
        conn.release();
      })
    );
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();

function newTopic({ title, link, contentSnippet, isoDate }, tag) {
  return {
    title: title.trim(/[\s\t]/gm, ""),
    link: link.trim(/[\s\t]/gm, ""),
    contentSnippet,
    isoDate: new Date(isoDate),
    tag: tag.join(","),
  };
}
