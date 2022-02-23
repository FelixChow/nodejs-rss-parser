const md5 = require("md5");
const yaml = require("js-yaml");
const fs = require("fs");
const { dbconfig } = yaml.load(fs.readFileSync("config.yaml", "utf-8"));
const topic = yaml.load(fs.readFileSync("topic.yaml", "utf-8"));
const mysql = require("mysql2/promise");
var pool = mysql.createPool(dbconfig);

(async () => {
  await pool
    .getConnection()
    .then(async (conn) => {
      await conn.beginTransaction();
      for (let { name } of topic) {
        await conn
          .query("INSERT INTO topic SET ?", {
            topic: name,
            hash_id: md5(name),
            count: 1,
          })
          .then((res) => {
            console.log(res);
          })
          .catch((err) => {
            console.error(err);
            conn.rollback();
            throw err;
          });
      }
      conn.commit();
      conn.release();
    })
    .catch((err) => {
      console.error(err);
    });
  await pool.end();
})();
