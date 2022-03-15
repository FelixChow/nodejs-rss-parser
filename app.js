const Parser = require("rss-parser");
const parser = new Parser();
const { dbconfig, kafkaconfig } = require("./config");
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

      conn = await pool.getConnection();
      const rss = await conn
        .query("SELECT * FROM rss_source WHERE enabled = 1")
        .then((res) => res[0]);
      conn.release();

      let currenttime = new Date();
      currenttime.setDate(currenttime.getDate() - 1);
      let threshold = currenttime.toISOString();

      await Promise.all(
        rss.map(async (src) => {
          let { id, url, last_hash } = src;
          let feed = await parser.parseURL(url).catch((e) => {
            console.error("[ERROR] Error fetching RSS from %s", url);
            console.error(e);
          });

          if (feed == undefined) return;

          feed.items = feed.items.filter(
            (it) => !it.isoDate || it.isoDate > threshold
          );

          let last_match = feed.items.findIndex(
            (it) => last_hash == md5(it.title)
          );
          if (last_match > -1) feed.items.splice(last_match);

          if (feed.items.length == 0) return;

          let messages = [];
          let snapshot = await Promise.all(
            feed.items.map(async (item) => {
              return await solrgrpc
                .scanNews(`${item.title}${item.contentSnippet}`)
                .then(({ found, tag }) => {
                  if (found) {
                    messages.push(producePayload(item, tag));
                    return item.title;
                  }
                });
            })
          );
          // { title, link, contentSnippet, isoDate }
          if (messages.length > 0) {
            console.info("%o", {
              timestamp: new Date().toISOString(),
              source: url,
              news: snapshot.filter((it) => !!it),
            });
            messages.reverse();
            await producer.connect();
            await producer.send({
              topic: tagQueue,
              messages,
              compression: CompressionTypes.GZIP,
            });
          }
          console.info("%o", {
            timestamp: new Date().toISOString(),
            source: url,
            last_hash,
            next_title: feed.items[0].title,
            next_hash: md5(feed.items[0].title),
          });
          conn = await pool.getConnection();
          await conn
            .query("UPDATE rss_source SET last_hash = ? WHERE id = ?", [
              md5(feed.items[0].title),
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
  "Asia/Hong_Kong",
  null,
  true
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
