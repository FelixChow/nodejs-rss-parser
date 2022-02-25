const yaml = require("js-yaml");
const fs = require("fs");
const axios = require("axios").default;
const { solr, dbconfig } = yaml.load(fs.readFileSync("config.yaml", "utf-8"));
const mysql = require("mysql2/promise");

(async () => {
  const pool = mysql.createPool(dbconfig);
  const solrquery = `http://${solr.host}:${solr.port}/solr/${solr.core}/update?commit=true`;
  try {
    const tags = await pool
      .getConnection()
      .then((conn) => {
        const res = conn.query("SELECT topic, hash_id FROM topic");
        conn.release();
        return res;
      })
      .then((result) => {
        console.debug(result[0]);
        return result[0];
      });
    await axios
      .post(
        solrquery,
        tags.map(({ topic, hash_id }) => ({ name: topic, id: hash_id }))
      )
      .then((res) => {
        console.debug(res.data);
      });
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
