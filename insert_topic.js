const md5 = require("md5");
const yaml = require("js-yaml");
const fs = require("fs");
const { dbconfig } = yaml.load(fs.readFileSync("config.yaml", "utf-8"));
const topic = yaml.load(fs.readFileSync("topic.yaml", "utf-8"));
const mysql = require("mysql2/promise");

(async () => {
  const pool = mysql.createPool(dbconfig);
  try {
    await pool.getConnection().then(async (conn) => {
      await conn.beginTransaction();
      try {
        for (let { name } of topic) {
          await conn.query(
            "INSERT INTO topic SET ? ON DUPLICATE KEY UPDATE count = count + 1",
            {
              topic: name,
              hash_id: md5(name),
              count: 1,
            }
          );
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    });
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
