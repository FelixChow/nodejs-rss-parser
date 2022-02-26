const yaml = require("js-yaml");
const fs = require("fs");
const { dbconfig, kafkaconfig } = yaml.load(
  fs.readFileSync("config.yaml", "utf-8")
);
const mysql = require("mysql2/promise");
const { Kafka, CompressionTypes } = require("kafkajs");
const kafka = new Kafka(kafkaconfig);
const consumer = kafka.consumer({ groupId: "hit-topic-consumer" });
const producer = kafka.producer();
const tagQueue = "tag-queue";
const pushQueue = "push-queue";

(async () => {
  const conn = await mysql.createConnection(dbconfig);
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: tagQueue, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let { title, link, contentSnippet, tag } = JSON.parse(
        message.value.toString()
      );
      let sql = `SELECT user_id, topic_id, topic 
      FROM user_subscribed_topic ust 
      JOIN topic t ON ust.topic_id = t.hash_id 
      WHERE topic_id in ('${tag.join("','")}')`;

      let [users, _] = await conn.execute(sql);
      users = users.reduce((acc, curr) => {
        if (!acc[`${curr.user_id}`]) acc[`${curr.user_id}`] = [];
        acc[`${curr.user_id}`].push(curr.topic);
        return acc;
      }, {});
      if (!!users && Object.keys(users).length > 0)
        await producer.send({
          topic: pushQueue,
          messages: [
            { value: JSON.stringify({ title, link, contentSnippet, users }) },
          ],
          compression: CompressionTypes.GZIP,
        });
      //   console.log({
      //     partition,
      //     offset: message.offset,
      //   });
    },
  });
})();
