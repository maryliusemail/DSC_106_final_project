const metricConfig = {
  count: {
    label: "Games",
    subtitle: "Top genres by number of games",
    value: (d) => d.count,
    format: (value) => Math.round(value).toLocaleString(),
    detail: (d) => `${d.count.toLocaleString()} games`,
  },
  rating: {
    label: "Positive Rating",
    subtitle: "Top genres by average positive rating",
    value: (d) => d.avgRating,
    format: (value) => `${value.toFixed(1)}%`,
    detail: (d) => `${d.avgRating.toFixed(1)}% average positive rating`,
  },
  playtime: {
    label: "Playtime",
    subtitle: "Top genres by average playtime",
    value: (d) => d.avgPlaytime,
    format: (value) => `${Math.round(value).toLocaleString()} min`,
    detail: (d) => `${Math.round(d.avgPlaytime).toLocaleString()} average minutes played`,
  },
  price: {
    label: "Price",
    subtitle: "Top genres by average price",
    value: (d) => d.avgPrice,
    format: (value) => `$${value.toFixed(2)}`,
    detail: (d) => `$${d.avgPrice.toFixed(2)} average price`,
  },
};

const state = {
  rows: [],
  summaries: [],
  metric: "count",
  genre: "all",
};

const chart = document.querySelector("#genre-chart");
const tooltip = document.querySelector("#tooltip");
const genreSelect = document.querySelector("#genre-select");
const subtitle = document.querySelector("#chart-subtitle");
const selectionOutput = document.querySelector("#selection-output");

fetch("Data/steam.csv")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Could not load Data/steam.csv");
    }
    return response.text();
  })
  .then((text) => {
    state.rows = parseCsv(text).map(cleanRow).filter((d) => d.genre);
    state.summaries = summarizeByGenre(state.rows);
    populateGenreSelect(state.summaries);
    updateStats(state.rows);
    render();
  })
  .catch((error) => {
    chart.outerHTML = `<p class="load-error">${error.message}</p>`;
  });

document.querySelectorAll(".metric-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.metric = button.dataset.metric;
    document.querySelectorAll(".metric-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    render();
  });
});

genreSelect.addEventListener("change", () => {
  state.genre = genreSelect.value;
  const filteredRows = state.genre === "all" ? state.rows : state.rows.filter((d) => d.genre === state.genre);
  updateStats(filteredRows);
  render();
});

window.addEventListener("resize", () => render());

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      if (row.some((value) => value.length)) {
        rows.push(row);
      }
      field = "";
      row = [];
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function cleanRow(row) {
  const positive = Number(row.positive_ratings) || 0;
  const negative = Number(row.negative_ratings) || 0;
  const totalRatings = positive + negative;

  return {
    name: row.name,
    genre: row.genres ? row.genres.split(";")[0] : "Unknown",
    price: Number(row.price) || 0,
    playtime: Number(row.average_playtime) || 0,
    rating: totalRatings ? (positive / totalRatings) * 100 : 0,
    totalRatings,
  };
}

function summarizeByGenre(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    if (!grouped.has(row.genre)) {
      grouped.set(row.genre, {
        genre: row.genre,
        count: 0,
        ratingTotal: 0,
        priceTotal: 0,
        playtimeTotal: 0,
      });
    }

    const group = grouped.get(row.genre);
    group.count += 1;
    group.ratingTotal += row.rating;
    group.priceTotal += row.price;
    group.playtimeTotal += row.playtime;
  });

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    avgRating: group.ratingTotal / group.count,
    avgPrice: group.priceTotal / group.count,
    avgPlaytime: group.playtimeTotal / group.count,
  }));
}

function populateGenreSelect(summaries) {
  summaries
    .slice()
    .sort((a, b) => b.count - a.count)
    .forEach((summary) => {
      const option = document.createElement("option");
      option.value = summary.genre;
      option.textContent = `${summary.genre} (${summary.count.toLocaleString()})`;
      genreSelect.append(option);
    });
}

function updateStats(rows) {
  const games = rows.length;
  const avgRating = average(rows, (d) => d.rating);
  const avgPrice = average(rows, (d) => d.price);
  const avgPlaytime = average(rows, (d) => d.playtime);

  document.querySelector("#stat-games").textContent = games.toLocaleString();
  document.querySelector("#stat-rating").textContent = `${avgRating.toFixed(1)}%`;
  document.querySelector("#stat-price").textContent = `$${avgPrice.toFixed(2)}`;
  document.querySelector("#stat-playtime").textContent = `${Math.round(avgPlaytime).toLocaleString()} min`;
}

function average(rows, accessor) {
  if (!rows.length) {
    return 0;
  }
  return rows.reduce((sum, row) => sum + accessor(row), 0) / rows.length;
}

function render() {
  if (!state.summaries.length) {
    return;
  }

  const metric = metricConfig[state.metric];
  const isSingleGenre = state.genre !== "all";
  const data = isSingleGenre
    ? state.summaries.filter((d) => d.genre === state.genre)
    : state.summaries.slice().sort((a, b) => metric.value(b) - metric.value(a)).slice(0, 12);

  subtitle.textContent = isSingleGenre ? `${metric.label} for ${state.genre}` : metric.subtitle;
  selectionOutput.textContent = isSingleGenre ? state.genre : "All genres";
  drawBarChart(data, metric);
}

function drawBarChart(data, metric) {
  const width = chart.clientWidth || 800;
  const height = chart.clientHeight || 500;
  const margin = {
    top: 20,
    right: 24,
    bottom: 36,
    left: width < 560 ? 112 : 150,
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const rowHeight = innerHeight / Math.max(data.length, 1);
  const maxValue = Math.max(...data.map(metric.value), 1);

  chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  chart.innerHTML = "";
  tooltip.hidden = true;

  const gridGroup = createSvgElement("g", { class: "axis" });
  [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
    const x = margin.left + innerWidth * tick;
    gridGroup.append(createSvgElement("line", {
      class: "grid-line",
      x1: x,
      x2: x,
      y1: margin.top,
      y2: height - margin.bottom,
    }));
    gridGroup.append(createSvgElement("text", {
      x,
      y: height - 10,
      "text-anchor": tick === 0 ? "start" : "middle",
    }, metric.format(maxValue * tick)));
  });
  chart.append(gridGroup);

  data.forEach((datum, index) => {
    const y = margin.top + index * rowHeight + rowHeight * 0.18;
    const barHeight = Math.max(18, rowHeight * 0.58);
    const value = metric.value(datum);
    const barWidth = Math.max(2, (value / maxValue) * innerWidth);

    chart.append(createSvgElement("text", {
      class: "bar-label",
      x: margin.left - 12,
      y: y + barHeight * 0.66,
      "text-anchor": "end",
    }, datum.genre));

    const bar = createSvgElement("rect", {
      class: "bar",
      tabindex: "0",
      x: margin.left,
      y,
      width: barWidth,
      height: barHeight,
      rx: 5,
      "aria-label": `${datum.genre}: ${metric.detail(datum)}`,
    });

    bar.addEventListener("mousemove", (event) => showTooltip(event, datum, metric));
    bar.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
    });
    bar.addEventListener("focus", (event) => showTooltip(event, datum, metric));
    bar.addEventListener("blur", () => {
      tooltip.hidden = true;
    });

    chart.append(bar);
    chart.append(createSvgElement("text", {
      class: "value-label",
      x: Math.min(margin.left + barWidth + 8, width - margin.right - 70),
      y: y + barHeight * 0.66,
    }, metric.format(value)));
  });
}

function showTooltip(event, datum, metric) {
  const bounds = chart.getBoundingClientRect();
  const sourceX = event.clientX || bounds.left + Number(event.target.getAttribute("x"));
  const sourceY = event.clientY || bounds.top + Number(event.target.getAttribute("y"));

  tooltip.innerHTML = `
    <strong>${datum.genre}</strong>
    ${metric.detail(datum)}<br>
    ${datum.count.toLocaleString()} games in this group
  `;
  tooltip.style.left = `${Math.min(sourceX - bounds.left + 14, bounds.width - 250)}px`;
  tooltip.style.top = `${Math.max(sourceY - bounds.top - 12, 8)}px`;
  tooltip.hidden = false;
}

function createSvgElement(tag, attributes = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text) {
    element.textContent = text;
  }
  return element;
}
