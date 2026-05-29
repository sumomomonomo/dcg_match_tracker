const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("DCG Match Tracker");
});

app.listen(8000, () => {
  console.log("Server started");
});