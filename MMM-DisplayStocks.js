/* Magic Mirror
 * Module: MMM-DisplayStocks
 *
 * By Rob
 * MIT Licensed.
 */

const PAGE_SIZE = 5;

function chunkArrayInGroups(arr, size) {
  const newArray = [];
  for (let i = 0; i < arr.length; i += size) {
    newArray.push(arr.slice(i, i + size));
  }
  return newArray;
}

Module.register("MMM-DisplayStocks", {
  defaults: {
    updateInterval: 180000,
    retryDelay: 5000,
    language: "en",
    twoDigitCountryCode: "US",
    containerClass: "medium",
    paginate: true
  },

  requiresVersion: "2.1.0", // Required version of MagicMirror

  start: function () {
    var self = this;
    var dataRequest = null;
    var dataNotification = null;

    //Flag for check if module is loaded
    this.loaded = false;

    // Schedule update timer.
    this.getData();
    setInterval(function () {
      self.updateDom();
    }, this.config.updateInterval);
  },

  getCurrencyFromCulture: function (culture) {
    const country = culture.split(2, 4);
    switch (country) {
      case "US":
      default:
        return "USD";
    }
  },

  /*
   * getData
   * function example return data and show it in the module wrapper
   * get a URL request
   *
   */
  getData: function () {
    var self = this;

    var urlApi = (symbols) => {
      let url = symbols.reduce((acc, symbol, index) => {
        const suffix = index === symbols.length - 1 ? "&" : ",";
        return (acc += `${symbol.trim().toUpperCase()}${suffix}`);
      }, "https://cloud.iexapis.com/v1/stock/market/batch?types=quote&symbols=");
      url += `token=${self.config.appId}`;
      return url;
    };

    var retry = true;

    var dataRequest = new XMLHttpRequest();

    var symbols = self.config.symbols || [];
    if (!symbols.length) {
      self.processData({});
    }

    const url = urlApi(symbols);

    dataRequest.open("GET", url, true);
    dataRequest.onreadystatechange = function () {
      console.log(this.readyState);
      if (this.readyState === 4) {
        console.log(this.status);
        if (this.status === 200) {
          self.processData(JSON.parse(this.response));
        } else if (this.status === 401) {
          self.updateDom(self.config.animationSpeed);
          Log.error(self.name, this.status);
          retry = false;
        } else {
          Log.error(self.name, "Could not load data.");
        }
        if (retry) {
          self.scheduleUpdate(self.loaded ? -1 : self.config.retryDelay);
        }
      }
    };
    dataRequest.send();
  },

  /* scheduleUpdate()
   * Schedule next update.
   *
   * argument delay number - Milliseconds before next update.
   *  If empty, this.config.updateInterval is used.
   */
  scheduleUpdate: function (delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }
    nextLoad = nextLoad;
    var self = this;
    setTimeout(function () {
      self.getData();
    }, nextLoad);
  },

  pages: { page: 1, maxPages: 1, shouldScroll: false },

  updatePage: function () {
    const self = this;
    // hide page
    const showingPage = document.querySelector(
      `.pageNumber-${self.pages.page}`
    );
    showingPage.classList.remove("show");
    showingPage.classList.add("hide");

    if (self.pages.page === self.pages.maxPages) {
      self.pages.page = 1;
    } else {
      self.pages.page += 1;
    }

    //show new page
    const newShowingPage = document.querySelector(
      `.pageNumber-${self.pages.page}`
    );
    newShowingPage.classList.remove("hide");
    newShowingPage.classList.add("show");
  },

  pageChangeInterval: null,

  startPaging: function () {
    const self = this;
    if (
      self.config.paginate &&
      self.pages.shouldScroll &&
      !self.pageChangeInterval
    ) {
      self.pageChangeInterval = setInterval(self.updatePage.bind(self), 5000);
    }
  },

  getDom: function () {
    var self = this;

    // create element wrapper for show into the module
    var wrapper = document.createElement("div");

    if (!this.config.appId) {
      wrapper.innerHTML = "No API Key Provided";
      return;
    }

    if (this.dataRequest) {
      var wrapperDataRequest = document.createElement("div");
      const symbols = Object.keys(this.dataRequest);

      if (symbols.length > PAGE_SIZE) {
        self.pages.shouldScroll = true;
        self.pages.maxPages = Math.ceil(symbols.length / PAGE_SIZE);
        self.startPaging();
      }

      wrapperDataRequest.classList.add(
        self.pages.shouldScroll ? "scroll-list" : "list"
      );

      const symbolsPages = chunkArrayInGroups(symbols, PAGE_SIZE);

      symbolsPages.forEach((symbolPage, index) => {
        const pageDiv = document.createElement("div");
        const pageNumber = index + 1;
        pageDiv.classList.add("page");
        pageDiv.classList.add(`pageNumber-${pageNumber}`);
        pageDiv.classList.add(pageNumber === self.pages.page ? "show" : "hide");

        symbolPage.forEach((symbol) => {
          const symbolDiv = document.createElement("div");
          symbolDiv.classList.add("MMM-Display-Stock");
          symbolDiv.classList.add(self.config.containerClass || "medium");

          const culture = `${self.config.language}-${self.config.twoDigitCountryCode}`;
          const _symbol = self.dataRequest[symbol];

          const currentPrice = _symbol
            ? new Intl.NumberFormat(culture, {
                style: "currency",
                currency: self.getCurrencyFromCulture(culture)
              }).format(_symbol.quote.latestPrice.toFixed(2))
            : "Unknown";

          const priceDiv = document.createElement("div");

          priceDiv.innerHTML = currentPrice
            ? `${symbol}: ${currentPrice}`
            : `${symbol}: Unknown`;

          const priceChangeDiv = document.createElement("div");
          const upOrDownArrow = _symbol.change >= 0 ? "\u2b61" : "\u2b63";

          priceChangeDiv.innerHTML = _symbol
            ? ` ${upOrDownArrow}(${_symbol.quote.change})`
            : "";

          symbolDiv.appendChild(priceDiv);
          symbolDiv.appendChild(priceChangeDiv);

          pageDiv.appendChild(symbolDiv);
        });
        wrapperDataRequest.appendChild(pageDiv);
      });

      wrapper.appendChild(wrapperDataRequest);
    }

    return wrapper;
  },

  getScripts: function () {
    return [];
  },

  getStyles: function () {
    return ["MMM-DisplayStocks.css"];
  },

  // Load translations files
  getTranslations: function () {
    //FIXME: This can be load a one file javascript definition
    return {
      en: "translations/en.json"
    };
  },

  processData: function (data) {
    var self = this;
    this.dataRequest = data;
    if (this.loaded === false) {
      self.updateDom(self.config.animationSpeed);
    }
    this.loaded = true;

    // the data if load
    // send notification to helper
    this.sendSocketNotification("MMM-DisplayStocks-NOTIFICATION_TEST", data);
  },

  // socketNotificationReceived from helper
  socketNotificationReceived: function (notification, payload) {
    if (notification === "MMM-DisplayStocks-NOTIFICATION_TEST") {
      // set dataNotification
      this.dataNotification = payload;
      this.updateDom();
    }
  }
});
