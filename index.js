require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");
const { exec } = require("child_process");
const getPage = require("./modules/solveCaptcha");
const today = new Date();
const day = String(today.getDate()).padStart(2, "0");
const month = String(today.getMonth() + 1).padStart(2, "0");
const year = today.getFullYear();
const baseUrl = "https://service2.diplo.de/rktermin/";
const bookAppointment = require("./modules/bookAppointment");

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

  const browser = await puppeteer.launch({
    headless: false
  });

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
      const page = await browser.newPage();
      for (const contentItem of category.content) {
        let availArr = [];
        for (let i = 1; i <= 2; i++) {
          await page.setCacheEnabled(false);
          let urlToCheckAvail =
            contentItem.url +
            `&dateStr=${day}.${String(parseInt(month) + (i - 1)).padStart(
              2,
              "0"
            )}.${year}`;
          await page.goto(urlToCheckAvail, { waitUntil: "domcontentloaded" });
          await getPage(page);
          const checkCaptcha = await page.evaluate(() => {
            const captchaImage = document.querySelector("captcha div");
            if (captchaImage) {
              return true;
            }
            return false;
          });
          if (checkCaptcha) {
            continue;
          }
          console.log("checking appointments");
          // Extract appointment data
          const appointments = await page.evaluate(baseUrl => {
            const data = {};
            const appointmentElements = document.querySelectorAll(
              'div[style="width: 100%;"]'
            );

            appointmentElements.forEach(element => {
              const dateElement = element.querySelector("h4");
              const linkElement = element.querySelector("a.arrow");

              if (dateElement && linkElement) {
                const fullDateText = dateElement.textContent.trim(); // E.g., "SUNDAY 19.01.2025"
                const dateMatch = fullDateText.match(/\d{2}\.\d{2}\.\d{4}/); // Extract "19.01.2025"

                if (dateMatch) {
                  const key = dateMatch[0];
                  const status = linkElement.textContent.trim(); // E.g., "Appointments are available"
                  const link = linkElement.getAttribute("href"); // Get the link URL from the 'href' attribute

                  // Store the data with date, status, and link
                  data[key] = {
                    name: category.content.name,
                    date: fullDateText,
                    status: status,
                    link: baseUrl + link
                  };
                }
              }
            });

            return data;
          }, baseUrl);
          if (Object.entries(appointments).length > 0) {
            availArr.push(appointments);
          }
          console.log(availArr);
        }
        // Save the updated URLs to a JSON file
        fs.writeFileSync(
          "appointments.json",
          JSON.stringify(availArr, null, 2),
          "utf-8"
        );
      }
    }
  }



  async function checkAvailability() {
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

  try {
    // await getPages();
    // await checkAvailability();
    const workingUrl = await bookAppointment(browser, "https://service2.diplo.de/rktermin/extern/appointment_showDay.do?locationCode=doha&realmId=1448&categoryId=3511&dateStr=23.02.2025");
    console.log(workingUrl);
  } catch (error) {
    console.error(`Error opening the URL: ${error.message}`);
  } finally {
    // await browser.close();
  }
})();
