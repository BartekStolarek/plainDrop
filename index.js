const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const multerGridStorage = require('multer-gridfs-storage');
const gridStream = require('gridfs-stream');
const methodOverride = require('method-override');
const url = require('url');
const aws = require('aws-sdk');

const app = express();

app.use("/public", express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

let s3 = new aws.S3({
    mongoCredentials: process.env.mongoURI
});

//Provide your mongoURI here- it can be local database or remote
const mongoURI = s3.mongoCredentials;

const conn = mongoose.createConnection(mongoURI);

let gfs;
conn.once('open', () => {
    gfs = gridStream(conn.db, mongoose.mongo);
    gfs.collection('uploads');
})

const storage = new multerGridStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
            if (err) {
            return reject(err);
            }
            const filename = buf.toString('hex') + path.extname(file.originalname);
            const fileInfo = {
            filename: filename,
            bucketName: 'uploads'
            };
            resolve(fileInfo);
        });
        });
    }
});
const upload = multer({ storage });

app.get('/', (req, res) => {
    res.render('index');
});
app.get('/regulations', (req, res) => {
    res.render('regulations');
});
app.post('/upload', upload.single('file'), (req, res) => {
    res.redirect('/files/' + req.file.filename);
});
//display all files in json
// app.get('/files', (req, res) => {
//     gfs.files.find().toArray((err, files) => {
//         if (!files || files.length === 0) {
//             return res.status(404).json({
//                 err: 'No files exist'
//             });
//         }

//         return res.json(files);
//     });
// });

app.get('/files/:filename', (req, res) => {
    let filename = req._parsedUrl.pathname.toString().substr(7);

    gfs.files.findOne({ filename: filename}, function (err, file) {
        if (file) {
            res.render('file', {filename: filename});
        }
        else {
            res.render('file', {filename: ''});
        }
    });
});

app.post('/files/download/:filename', (req, res) => {

    gfs.files.findOne({ filename: req.params.filename}, function (err, file) {
        if (file) {
            //Download File
            res.set('Content-Type', file.contentType);
            res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');

            var readstream = gfs.createReadStream({
              _id: file._id,
              root: 'uploads'
            });

            readstream.on("error", function(err) { 
                res.end();
            });
            readstream.pipe(res);
        }
    });
});

app.get('*', (req, res) => {
    res.render('404');
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log('Server started on port 5000'));