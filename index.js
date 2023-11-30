
(async () => {

  const fs  = require("fs");
  const csv = require("csv-parser");
  const fg  = require("fast-glob");

  let rows = [];

  const dailysub = 0.58;
  const price    = 4.04 / 6.23;
  const tax      = 1 + 1.54 / (4.04 + dailysub);

  const getPrice = (kwh, days = 1) => (kwh * price + dailysub * days) * tax;

  for (const filename of await fg(["*.csv"])) {

    fs.createReadStream(filename)
      .pipe(csv({
        separator: ";",
        headers  : ["energie", "date", "volume", "coef", "kwh"],
      }))
      .on("data", row => {

        row.date = new Date(row.date.split("/").reverse().join("-") + "T00:00:00Z");

        if (isNaN(row.date.getTime()))
          return;

        row.volume = Number(row.volume.replace(/\s.*$/, "").replace(",", ".")); // en m³
        row.coef   = Number(row.coef);
        row.kwh    = row.volume * row.coef;
        row.price  = getPrice(row.kwh);

        rows.push(row);
      })
      .on("end", () => {

        rows = rows.reverse();

        const limit = new Date(
          rows[0].date.toISOString().replace(/^(\d{4})/, (y, year) => Number(year) - 1),
        );

        rows = rows.filter(row => row.date > limit);

        console.table(rows.reduce((acc, row) => {
          acc[row.date.toISOString().replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, "$3-$2-$1")] = {
            volume: row.volume.toFixed(2) + " m³",
            kwh   : row.kwh.toFixed(2) + " kWh",
            price : row.price.toFixed(2) + "€",
          };
          return acc;
        }, {}));

        const {totalVolume, totalKwh, totalDays} = rows.reduce((acc, row) => {
          acc.totalVolume += row.volume;
          acc.totalKwh    += row.kwh;
          acc.totalDays++;
          return acc;
        }, {
          totalVolume: 0,
          totalKwh   : 0,
          totalDays  : 0,
        });

        const totalPrice = Math.round(getPrice(totalVolume, totalDays));

        const yearVolume = Math.round(totalVolume / totalDays * 365);
        const yearKwh    = Math.round(totalKwh / totalDays * 365);
        const yearPrice  = Math.round(totalPrice / totalDays * 365);

        console.log([
          "",
          totalDays + " jours",
          yearVolume.toFixed() + "m³",
          yearKwh.toFixed() + "kWh",
          yearPrice.toFixed() + "€",
          "",
          (totalPrice / totalDays).toFixed(2) + "€/jour",
          (totalPrice / totalDays * 365 / 12).toFixed(2) + "€/mois",
          "",
        ].join("\n"));
      });

    break;
  }

})();