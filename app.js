const Parser = require("rss-parser");
const parser = new Parser();
const axios = require("axios").default;
const { solr, dbconfig, kafkaconfig } = require("./config");
const mysql = require("mysql2/promise");
const md5 = require("md5");
const { Kafka, CompressionTypes } = require("kafkajs");
const kafka = new Kafka(kafkaconfig);
const producer = kafka.producer();
const tagQueue = "tag-queue";
const solrgrpc = require("./solr_grpc_client");
const CronJob = require("cron").CronJob;

const job = new CronJob(
  process.env.CRON_TIME || "0 */15 * * * *",
  async function () {
    const pool = mysql.createPool(dbconfig);
    try {
      let insync = await solrgrpc.syncSolr();
      if (!insync || !insync.success) {
        console.warn("[WARN] Solr gRPC service unavailable");
        return;
      }

      solrquery = `http://${solr.host}:${solr.port}/solr/${solr.core}/tag?overlaps=NO_SUB&tagsLimit=5000&fl=id,name,countrycode&wt=json&indent=on`;
      conn = await pool.getConnection();
      const rss = await conn
        .query("SELECT * FROM rss_source WHERE enabled = 1")
        .then((res) => res[0]);
      conn.release();
      await Promise.all(
        rss.map(async (src) => {
          let { id, url, last_hash } = src;
          let feed = await parser.parseURL(url).catch((e) => {
            console.error(e);
          });

          if (feed == undefined) return;

          let messages = [];
          for (let item of feed.items) {
            if (!!last_hash && last_hash == md5(item.link)) break;
            await axios
              .post(solrquery, `${item.title}${item.contentSnippet}`, {
                headers: { "Content-Type": "text/plain" },
              })
              .then(async (res) => {
                let { numFound, docs } = res.data.response;
                // res.data.response: {numFound: 1, start: 0, numFoundExact: true, docs: Array(1)}
                if (numFound > 0) {
                  tag = docs.map(({ id }) => id);
                  messages.push(producePayload(item, tag));
                }
              })
              .catch((e) => {
                console.error(e);
              });
            // { title, link, contentSnippet, isoDate }
          }
          if (messages.length > 0) {
            await producer.connect();
            await producer.send({
              topic: tagQueue,
              messages,
              compression: CompressionTypes.GZIP,
            });
          }
          conn = await pool.getConnection();
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
      await producer.disconnect();
    }
  },
  null,
  true,
  "Asia/Hong_Kong"
);

job.start();

function newTopic({ title, link, contentSnippet, isoDate }, tag) {
  return {
    title: title.trim(/^[\n\s\t]+|[\n\s\t]+$/gm, ""),
    link: link.trim(/^[\n\s\t]+|[\n\s\t]+$/gm, ""),
    contentSnippet,
    isoDate: new Date(isoDate),
    tag,
  };
}

function producePayload(item, tag) {
  return { value: JSON.stringify(newTopic(item, tag)) };
}
