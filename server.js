var express = require('express');
var app = express();
var session = require ('express-session')
const crypto = require('crypto');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var imgSchema = require(__dirname + '/public/js/model.js');
console.log(__dirname)
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');

const { spawn } = require('child_process');
var fs = require('fs');
var path = require('path');
app.use(express.static('public'));
app.set("view engine", "false");

const dotenv = require("dotenv");
dotenv.config();

// Generate a random secret key
const secretKey = crypto.randomBytes(64).toString('hex');

// Add the express-session middleware with the secret key
app.use(
  session({
    secret: secretKey,
    resave: false,
    saveUninitialized: true,
  })
);
mongoose.connect("mongodb://127.0.0.1:27017/imagesInMongoApp")
  .then(() => console.log("Connection successful..."))
  .catch((err) => console.log(err));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var multer = require('multer');

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    const currentDate = new Date().toLocaleDateString('en-US').replace(/\//g, '-');
    const filename = req.body.email + '-' + currentDate + '.jpg';
    cb(null, filename);
    console.log(req.body.email)
  }
});

var upload = multer({ storage: storage });

app.get('/',(req,res)=>{
  res.render('home.ejs')
})
app.get('/image', (req, res) => {
  imgSchema.find({})
    .then((data, err) => {
      if (err) {
        console.log(err);
      }
      res.render('uploadedphotos', { items: data });
    });
});

//redirect test page
app.get('/test',(req,res)=>{
  res.render('test')
})
//redirect result page which is already set to redirect when user upload photo and details then it calls py script to use model and predict output
app.get('/result', (req, res) => {
  const pythonScript = spawn('python', ['scan.py']);
  let result = '';

  pythonScript.stdout.on('data', (data) => {
    const output = data.toString().trim();
    const match = output.match(/\d+\.\d+/);

    if (match) {
      result = parseFloat(match[0]).toFixed(2);
    } else {
      console.error('No floating-point number found in the output');
    }
  });

  pythonScript.stderr.on('data', (data) => {
    console.error(`Error from Python script: ${data}`);
  });

  pythonScript.on('close', (code) => {
    if (code === 0) {
      console.log('Python script execution completed successfully.');
      const recipientEmail = req.session.email;
      const sessionName = req.session.name
      var resultValue = result
      console.log("Your Result is: ",result)
      // Generate dynamic HTML for the PDF
      const dynamicHtml = generateDynamicHtml(sessionName,resultValue);

      // Send the email with the PDF attachment
      sendEmailWithPDF(result, recipientEmail, dynamicHtml)
        .then(() => {
          console.log('Email sent successfully!');
        })
        .catch((error) => {
          console.error('Error sending email:', error);
        });

      // Render the HTML page and pass the Python script result as a variable
      res.render('result', { result, email: recipientEmail ,sessionName});
    } else {
      console.error(`Python script execution failed with code ${code}`);
    }
  });
});


//send Email using Nodemailer

async function sendEmailWithPDF(result, recipientEmail, dynamicHtml) {
  try {
    if (!recipientEmail) {
      throw new Error('Recipient email not provided.');
    }

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    

    // Set content from the dynamic HTML and CSS
    await page.setContent(dynamicHtml, { waitUntil: 'domcontentloaded' });
    
    // Generate the PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    const transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey', // SMTP username
        pass: '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', // SMTP password
      },
    });

    // Define email data
    const mailOptions = {
      from: 'niravjangale@gmail.com',
      to: recipientEmail,
      subject: 'Your Result For Melanoma Cancer Detection',
      text: 'Please find the attached PDF file.',
      attachments: [
        {
          filename: 'Result.pdf',
          content: pdfBuffer,
        },
      ],
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    console.log('Email sent successfully!');
  } catch (error) {
    throw error;
  }
}


// It takes Photo as input 
 app.post('/test', upload.single('image'), async (req, res, next) => {
 
    try {
      let imageId;
  
      // Check if a new photo is uploaded
      if (req.file) {
        var obj = {
          name: req.body.name,
          desc: req.body.desc,
          email: req.body.email,
          img: {
            data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
            contentType: 'image/png'
          }
        };
        await imgSchema.create(obj);
      req.session.email = req.body.email;
      req.session.name = req.body.name;
      }
        
  
      // Redirect to the /result route with the email as a query parameter
      res.redirect(`/result`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal server error');
    }
  });
  
app.get('/pdf',(req,res)=>{
  res.render('pdf')
})


function generateDynamicHtml(sessionName,resultValue){
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return`
  <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF</title>
    <style>
    @import url('../node_modules/font-awesome/css/font-awesome.min.css');
    *{
      margin: 0;
      padding: 0;
      box-sizing: border-box;
  }
  .header{
      background-image: linear-gradient(70deg,rgb(32, 45, 161),rgba(162, 167, 210, 0));
      width: 70%;
      border-bottom-right-radius: 200px;
      padding-bottom: 50px;
  }
  .top{
      padding:40px 0 0 50px ;
      line-height:35px;
      color: #fff ;
  }
  .degree{
      color:#000;
      font-size:1.5rem
  }
  .footer{
      background-image: linear-gradient(-20deg,rgb(32, 45, 161),rgba(162, 167, 210, 0));
      padding: 10px;
      position: absolute;
      width: 100%;
      bottom: 0;
      right: 0;
      border-top-left-radius: 200px;
  }
  .bottom{
      position: relative;
      left: 150px;
      top: 0px;
      font-size: 1.5rem;
      width: 90%;
  }
  .left{
    position:relative;
    top:25px;
  }
  .right{
      display: flex;
      justify-content: center;
      align-items: center;
      flex: 2;
      width: 100%;
      font-size: 1.2rem;
      position: relative;
      top: -45px;
      left: 150px;
  }
  .upper {
      line-height: 50px;
      padding-right: 1.2rem;
  }
  .lower {
      line-height: 50px;
      padding-left: 1.2rem;
  }
  .website,.mobile,.landline,.email{
    display: flex;
    flex-direction: row;
    justify-content: start;
    align-items: center;
  }
  svg{
    width: 40px;
    height:40px;  
    padding-right: 1.2rem;
  }
  .add{
      position: relative;
      left: 100px;
      width: 500px;
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
  }
  .add p {
      color: #fff;
      font-size: 1.2rem;
  }
  .main{
    display: flex;
    flex-direction: column;
  }
  .main .name{
    display: flex;
    padding-left: 5rem;
    font-size: 1.8rem;
    align-items: center;
  }
  .main .information{
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    font-size: 1.5rem;
    padding-left: 25rem;
    padding-top: 8rem;
  }
  #info{
    padding-top: 2rem;
  }
  .image{
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50vh;
  }
</style>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
</head>
<body>
     <div class="header">
        <div class="top">
            <h1 class="dr">DR.Roronoa Zoro</h1>
            <p class="degree">Dermatologists</p>
        </div>
     </div>
     <div class="main">
     <div class="image">
      <img src="data:image/png;base64,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" alt="Your Uploaded Photo">
      </div><br/>
     <div class="name">
         <p id="name">Dear,${sessionName}</p>
     </div>
     <div class="information">
         <p id="information">
             You use our service on ${formattedDate} for checking you have melonama cancer or not.So, Your Result is ${resultValue}.
         </p>
         <p id="info">If you have high Percentage of Melanoma Cancer I kindly request that you should go to doctor immediately for checkup.</p>
     </div>
  </div>
     <div class="footer">
        <div class="bottom">
            <div class="left">
                <p style="color:#fff;">Thousand Sunny Hospital</p>
                <p style="font-size:1rem;">We will find One Piece</p>
            </div>
            <div class="right">
                <div class="upper">
                    <div class="website"><svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/></svg><p>www.onepice.com</p></div>
                    <div class="email"><svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512"><path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/></svg><p>kingofthepirates@luffy.com</p></div>
                </div>
                <div class="lower">
                    <div class="mobile"><svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512"><path d="M80 0C44.7 0 16 28.7 16 64V448c0 35.3 28.7 64 64 64H304c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H80zm80 432h64c8.8 0 16 7.2 16 16s-7.2 16-16 16H160c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></svg><p>+91-123-xxx-xxxx</p></div>
                    <div class="landline"><svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512"><path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"/></svg><p>02624-22xxxx</p></div>
                </div>
            </div>
            <div class="add">
            <svg xmlns="http://www.w3.org/2000/svg"height="1em" viewBox="0 0 512 512"><path d="M408 120c0 54.6-73.1 151.9-105.2 192c-7.7 9.6-22 9.6-29.6 0C241.1 271.9 168 174.6 168 120C168 53.7 221.7 0 288 0s120 53.7 120 120zm8 80.4c3.5-6.9 6.7-13.8 9.6-20.6c.5-1.2 1-2.5 1.5-3.7l116-46.4C558.9 123.4 576 135 576 152V422.8c0 9.8-6 18.6-15.1 22.3L416 503V200.4zM137.6 138.3c2.4 14.1 7.2 28.3 12.8 41.5c2.9 6.8 6.1 13.7 9.6 20.6V451.8L32.9 502.7C17.1 509 0 497.4 0 480.4V209.6c0-9.8 6-18.6 15.1-22.3l122.6-49zM327.8 332c13.9-17.4 35.7-45.7 56.2-77V504.3L192 449.4V255c20.5 31.3 42.3 59.6 56.2 77c20.5 25.6 59.1 25.6 79.6 0zM288 152a40 40 0 1 0 0-80 40 40 0 1 0 0 80z"/></svg><p>Onigashima,Behind Wano Land,New World</p>
            </div>
        </div>
     </div>   
</body>
</html>`
}

var port = process.env.PORT || '3000';
app.listen(port, (err) => {
  if (err) {
    throw err;
  }
  console.log(`Server listening on port http://localhost:${port}`);
});


