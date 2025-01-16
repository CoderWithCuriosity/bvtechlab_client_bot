require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");
const { exec } = require("child_process");
const { submitCaptchaForSolving } = require("./modules/captchaSolver");
//Check every 3 seconds
const availablityCheckSpeed = 3;
const browsers = [];
(async () => {
  const filePath = "./url.json";
  // Check if url.json exists
  if (!fs.existsSync(filePath)) {
    console.log("url.json does not exist. Executing init.js...");
    await new Promise((resolve, reject) => {
      exec("node ./modules/init.js", (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing init.js: ${error.message}`);
          reject(error);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          reject(new Error(stderr));
          return;
        }
        console.log(`stdout: ${stdout}`);
        resolve();
      });
    });
  }

  async function getPages() {
    // Read and parse url.json
    let urlData;
    try {
      urlData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (error) {
      console.error(`Error reading url.json: ${error.message}`);
      return;
    }
    for (const category of urlData) {
      for (const contentItem of category.content) {
        const browser = await puppeteer.launch({ headless: false });
        console.log(`Opening category: ${category.name}`);
        console.log(`Opening URL: ${contentItem.url}`);
        let countRetry = 3;
        while (countRetry > 0) {
          const newPage = await browser.newPage();
          await newPage.goto(contentItem.url, {
            waitUntil: "domcontentloaded"
          });
          console.log("Page opened successfully.");
          // Wait for the CAPTCHA image to load and get the base64 data
          const base64Image = await newPage.evaluate(() => {
            const regex = /url\("data:image\/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)"\)/;
            const captchaImage = document.querySelector("captcha div");
            if (captchaImage) {
              return captchaImage.style.backgroundImage.match(regex)[1]; // Extract the Base64 string
            }
            return null;
          });
          if (base64Image) {
            // Submit the CAPTCHA to TrueCaptcha for solving
            const solution = await submitCaptchaForSolving(base64Image);
            if (solution) {
              console.log("CAPTCHA solved:", solution);
              // Fill the CAPTCHA solution in the input field (adjust selector as needed)
              await newPage.type('input[name="captchaText"]', solution); // Replace with the actual input name or selector
              // Optionally, submit the form or click a button after solving the CAPTCHA
              await newPage.click(
                'input[id="appointment_captcha_month_appointment_showMonth"]'
              );
              await newPage.waitForNavigation();
              if (newPage.url() !== contentItem.url) {
                const checkCaptcha = await newPage.evaluate(() => {
                  const captchaImage = document.querySelector("captcha div");
                  if (captchaImage) {
                    return true;
                  }
                  return false;
                });
                if(checkCaptcha){
                  countRetry--;
                  await newPage.close();
                }
                console.log("Form submitted after CAPTCHA solved!");
                browsers.push(browser);
                break;
              } else {
                countRetry--;
                await newPage.close();
              }
            } else {
              console.error("Failed to solve the CAPTCHA.");
              countRetry--;
              await newPage.close();
            }
          } else {
            console.error("No CAPTCHA image found.");
            countRetry--;
            await newPage.close();
          }
        }
        if(countRetry <= 0){
          console.log('Recaptcha solver unable to solve the captcha. Please contact the developer.')
          return;
        }
      }
    }
  }

  async function getPage(browser, pageUrl) {
    let countRetry = 3;
    while (countRetry > 0) {
      const newPage = await browser.newPage();
      await newPage.goto(pageUrl, {
        waitUntil: "domcontentloaded"
      });
      console.log("Page opened successfully.");
      // Wait for the CAPTCHA image to load and get the base64 data
      const base64Image = await newPage.evaluate(() => {
        const regex = /url\("data:image\/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)"\)/;
        const captchaImage = document.querySelector("captcha div");
        if (captchaImage) {
          return captchaImage.style.backgroundImage.match(regex)[1]; // Extract the Base64 string
        }
        return null;
      });
      if (base64Image) {
        // Submit the CAPTCHA to TrueCaptcha for solving
        const solution = await submitCaptchaForSolving(base64Image);
        if (solution) {
          console.log("CAPTCHA solved:", solution);
          // Fill the CAPTCHA solution in the input field (adjust selector as needed)
          await newPage.type('input[name="captchaText"]', solution); // Replace with the actual input name or selector
          // Optionally, submit the form or click a button after solving the CAPTCHA
          await newPage.click(
            'input[id="appointment_captcha_month_appointment_showMonth"]'
          );
          await newPage.waitForNavigation();
          if (newPage.url() !== pageUrl) {
             const checkCaptcha = await newPage.evaluate(() => {
              const captchaImage = document.querySelector("captcha div");
              if (captchaImage) {
                return true;
              }
              return false;
            });
            if(checkCaptcha){
              countRetry--;
              await newPage.close();
            }
            console.log("Form submitted after CAPTCHA solved!");
            break;
          } else {
            countRetry--;
            await newPage.close();
          }
        } else {
          console.error("Failed to solve the CAPTCHA.");
          countRetry--;
          await newPage.close();
        }
      } else {
        console.error("No CAPTCHA image found.");
        countRetry--;
        await newPage.close();
      }
    }
    if(countRetry <= 0){
      console.log('Recaptcha solver unable to solve the captcha. Please contact the developer.')
      return;
    }
    return browser;
  }

  async function checkAvailability(browsers) {
    for (const browser of browsers) {
      try {
        const pages = await browser.pages();
        const validPages = pages.filter(page => page.url() !== "about:blank");
        for (const page of validPages) {
          try {
            await page.reload({ waitUntil: "domcontentloaded" });
            console.log(`Reloaded page: ${page.url()}`);
          } catch (error) {
            console.error(`Failed to reload page: ${page.url()}`, error);
          }
        }
      } catch (error) {
        console.error("Error in checkAvailability function", error);
      }
    }
  }
  try {
    await getPages();

    setInterval(() => checkAvailability(browsers), availablityCheckSpeed * 1000);
  } catch (error) {
    console.error(`Error opening the URL: ${error.message}`);
  } finally {
    // await browser.close();
  }
})();
