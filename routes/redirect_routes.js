const express = require("express");
const router = express.Router();

// GET /redeem
// This route serves the smart redirect page directly to the phone's browser
router.get("/redeem", (req, res) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redeeming KenUniv Gift...</title>
      <style>
          body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f4f4f4; text-align: center; }
          .loader { border: 5px solid #f3f3f3; border-top: 5px solid #C02221; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 20px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .btn { display: none; background: #C02221; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px; }
      </style>
  </head>
  <body>
      <div class="loader"></div>
      <h2 id="status-text">Opening KenUniv App...</h2>
      <p id="sub-text">If you are not redirected, please install the app below:</p>
      
      <a id="android-btn" class="btn" href="https://play.google.com/store/apps/details?id=com.kenunivapp.kenuniv_app">Download on Google Play</a>
      <a id="ios-btn" class="btn" href="https://apps.apple.com/in/app/kenuniv/id6755762927">Download on the App Store</a>

      <script>
          // Your links
          const playStoreLink = "https://play.google.com/store/apps/details?id=com.kenunivapp.kenuniv_app"; // CHANGE THIS
          const appStoreLink = "https://apps.apple.com/in/app/kenuniv/id6755762927"; // CHANGE THIS
          const appDeepLink = "kenuniv://redeem" + window.location.search; 

          const userAgent = navigator.userAgent || navigator.vendor || window.opera;

          setTimeout(function() {
              if (/android/i.test(userAgent)) {
                  document.getElementById('android-btn').style.display = 'inline-block';
                  window.location.href = appDeepLink;
                  setTimeout(function() { window.location.href = playStoreLink; }, 1500);
              } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
                  document.getElementById('ios-btn').style.display = 'inline-block';
                  window.location.href = appDeepLink;
                  setTimeout(function() { window.location.href = appStoreLink; }, 1500);
              } else {
                  document.getElementById('status-text').innerText = "Please scan this QR code with your mobile phone.";
                  document.getElementById('sub-text').style.display = "none";
                  document.querySelector('.loader').style.display = "none";
              }
          }, 500);
      </script>
  </body>
  </html>
  `;

  res.send(htmlContent);
});

module.exports = router;
