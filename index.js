require('dotenv').config();
const express = require('express'); 
const {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
    DeleteObjectCommand
} = require('@aws-sdk/client-s3'); 
const multer = require('multer'); 
const multerS3 = require('multer-s3'); 

const app = express(); 

// Create an S3 client instance without credentials
const s3Client = new S3Client({
    region: "ap-northeast-1", // specify your region
    // The SDK will automatically use the IAM role attached to the EC2 instance
});

// Get the bucket name from environment variables
const BUCKET_NAME = "swudds3bucket";

// Configure Multer for file uploads to S3
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: BUCKET_NAME,
        metadata: (req, file, cb) => {
            cb(null, { fieldName: file.fieldname }); 
        },
        key: (req, file, cb) => {
            cb(null, file.originalname); 
        },
    }),
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Upload to S3</title>
        </head>
        <body>
            <h1>Upload a file to Amazon S3</h1>
            <form action="/upload" method="POST" enctype="multipart/form-data">
                <input type="file" name="file" required>
                <button type="submit">Upload</button>
            </form>
            <h2>List Files in S3</h2>
            <button id="list-files">Show Files</button>
            <ul id="file-list"></ul>
            <script>
                document.getElementById('list-files').addEventListener('click', async () => {
                    const response = await fetch('/list');
                    const files = await response.json();
                    const fileList = document.getElementById('file-list');
                    fileList.innerHTML = '';
                    files.forEach(file => {
                        const li = document.createElement('li');
                        li.textContent = file;
                        fileList.appendChild(li);
                    });
                });
            </script>
        </body>
        </html>
    `);
});

// Route to handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
    res.send(`Successfully uploaded to ${req.file.location}!`);
});

// Route to list all files in the S3 bucket
app.get('/list', async (req, res) => {
    try {
        const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
        const response = await s3Client.send(command);
        const keys = response.Contents.map(item => item.Key); 
        res.json(keys);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to download a specific file from S3
app.get('/download/:filename', async (req, res) => {
    const { filename } = req.params;
    try {
        const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: filename });
        const response = await s3Client.send(command);
        
        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', response.ContentType);

        // Stream the file content to the response
        response.Body.pipe(res);
    } catch (error) {
        res.status(404).send('File Not Found');
    }
});

// Set the port for the server
const PORT = process.env.PORT || 3000; 

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
