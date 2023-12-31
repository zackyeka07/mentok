const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const baseUrl = "https://www.google.com/";
const {
    title
} = require('process');

let browser;
let page;

let stop = false;
const proccess = async (logToTextarea, logToTable, proggress, list, headless) => {
    browser = await puppeteer.launch({
        headless: headless,
        args: ["--force-device-scale-factor=0.5"]
    });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions(baseUrl, ["geolocation", "notifications"]);

    page = await browser.newPage();
    await page.goto(baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 120000
    });
    logToTextarea('[INFO] Opening Google...\n');

    const rawKeywords = fs.readFileSync(list, 'utf-8').split('\n');
    for (let i = 0; i < rawKeywords.length; i++) {
        const item = rawKeywords[i];
        const [keyword, target] = item.split(';');
        if (keyword && target) {
            await searchKeyword(page, keyword.trim(), target.trim(), logToTextarea, logToTable);
            const progressPercentage = parseInt(((i + 1) / rawKeywords.length) * 100);
            proggress(progressPercentage);
        } else {
            logToTextarea('Invalid line in the input file:', item);
        }

    }

    await browser.close();
};

async function searchKeyword(page, keyword, target, logToTextarea, logToTable) {
    await page.type('textarea[name="q"]', keyword, {
        delay: 100
    });
    logToTextarea(`Typing: ${keyword}...`);

    await Promise.all([
        page.keyboard.press("Enter"),
        page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 120000
        })
    ]);

    await scrollDownToBottom(page);
    let currentPage = 1;

    while (true) {
        logToTextarea(`Searching for websites on page ${currentPage}...`);
        const searchResults = await page.$$('[data-ved] a');
        logToTextarea("Number of Search Results: " + searchResults.length);

        for (let i = 0; i < searchResults.length; i++) {
            const href = await searchResults[i].evaluate(node => node.getAttribute("href"));
            if (href === target) {
                logToTextarea("Website found at index:", i + 1);
                logToTextarea('Found the website...✔\n');

                const index = i + 1;
                const titleElement = await searchResults[i].$eval('h3', node => node.innerText);
                const title = titleElement.trim();
                logToTable(index, title);
                
                return;
            }
        }

        const nextPageButtonWithNumber = await page.$(`[aria-label='Halaman ${currentPage + 1}']`);

        if (nextPageButtonWithNumber) {
            await nextPageButtonWithNumber.click();
        } else {
            const nextPageButton = await page.$("[aria-label='Halaman berikutnya']");
            if (nextPageButton) {
                await nextPageButton.click();
                logToTextarea("next page sudah di tekan")
            } else {
                logToTextarea("Website not found...❌");
                logToTextarea("Tidak Ditemukan", target, '\n');
                break;
            }
        }
        const cancel = await page.waitForSelector("[role='button'].M2vV3.vOY7J");
        logToTextarea("menekan button silang");
        if (cancel) {
            await cancel.click();
            await page.waitForTimeout(5000);
        }

        await page.waitForTimeout(3000);
        currentPage++;

    }
}

async function scrollDownToBottom(page) {
    let lastScrollPosition = 0;
    let retries = 3;

    while (retries > 0) {
        const currentScrollPosition = await page.evaluate(() => window.scrollY);
        if (currentScrollPosition === lastScrollPosition) {
            retries--;
        } else {
            retries = 3;
        }

        lastScrollPosition = currentScrollPosition;
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(1000);
    }
}

const stopProccess = (logToTextarea) => {
    stop = true;
}

module.exports = {
    proccess,
    stopProccess
}