const cors = require("cors")({ origin: true });
const sanitizeHtml = require("sanitize-html");

// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require("firebase-functions");

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);

// The express app used for routing
const app = require("express")();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// List all the posts under the path /posts
app.get(
  ["/", "/:id"],
  functions.https.onRequest((req, res) => {
    const postid = req.params.id;

    let reference = "posts";
    reference += postid ? "/" + postid : "";

    cors(req, res, () => {
      return admin
        .database()
        .ref(reference)
        .once("value")
        .then(function(snapshot) {
          if (snapshot.val() !== null) {
            console.log(res);
            return res.status(200).send(JSON.stringify(snapshot));
          } else {
            return res.status(200).send({});
          }
        });
    });
  })
);

app.post(
  "/",
  functions.https.onRequest((req, res) => {
    cors(req, res, () => {
      let content = req.body.content
        ? sanitizeHtml(req.body.content, {
            allowedTags: [],
            allowedAttributes: []
          })
        : null;
      if (content === null) {
        res.status(200).send({ error: "Missing content" });
        return;
      }

      const tokenId = req.body.token;
      console.log(tokenId);

      admin
        .auth()
        .verifyIdToken(tokenId)
        .then(function(decodedUser) {
          // set the content

          // title can be provided, or extracted from the content
          let title = req.body.title
            ? sanitizeHtml(req.body.title, {
                allowedTags: [],
                allowedAttributes: []
              })
            : content.substr(0, 20) + "...";

          // we want the server to set the time, so use the firebase timestamp
          let postDate = admin.database.ServerValue.TIMESTAMP;

          let postAuthor = decodedUser.name;

          let postData = {
            author: postAuthor,
            title: title,
            content: content,
            created: postDate
          };

          // create a new ID with empty values
          let postKey = admin
            .database()
            .ref("posts")
            .push().key;

          // set() will overwrite all values in the entry
          // update() will overwrite only the values passed in
          return admin
            .database()
            .ref("/posts")
            .child(postKey)
            .set(postData, function() {
              // Read the saved data back out
              return admin
                .database()
                .ref("/posts/" + postKey)
                .once("value")
                .then(function(snapshot) {
                  if (snapshot.val() !== null) {
                    let postJSON = snapshot.val();
                    postJSON.id = postKey;
                    return res.status(200).send(JSON.stringify(postJSON));
                  } else {
                    return res
                      .status(200)
                      .send({ error: "Unable to save post" });
                  }
                });
            });
        })
        .catch(err => res.status(401).send(err));
    });
  })
);

// set the routes up under the /posts/ endpoint
exports.posts = functions.https.onRequest(app);
