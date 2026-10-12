function createLineChart(container, data, actions) {
    const margin = { top: 26, right: 30, bottom: 45, left: 55 };
    const width = container.clientWidth;
    const height = container.clientHeight;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const time = 320;
    const yAxisSteps = [1, 2, 5, 10, 25, 50, 100, 200, 311];

    const styles = {
        normal:   { stroke: "lightgray", width: 1.5, opacity: 0.7 },
        dimmed:   { stroke: "lightgray", width: 1.5, opacity: 0.4 },
        selected: { stroke: "red",       width: 3,   opacity: 1 }
    };

    const svg = d3.select(container).append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.append("defs").append("clipPath")
        .attr("id", "line-chart-clip")
        .append("rect")
        .attr("x", -2)
        .attr("y", -2)
        .attr("width", chartWidth + 4)
        .attr("height", chartHeight + 4);

    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const points = data.artists.flatMap(artist => artist.values);
    const maxCards = d3.max(points, point => point.cards);

    const x = d3.scaleLinear()
        .domain(d3.extent(points, point => point.year))
        .range([0, chartWidth]);

    const y = d3.scaleSymlog()
        .constant(1)
        .domain([1, maxCards])
        .range([chartHeight, 0]);

    const fullX = x.domain();
    const fullY = y.domain();
    const fullYTicks = yAxisSteps.filter(step => step <= maxCards);
    let yTicks = fullYTicks;

    function addText(text, textX, textY) {
        return chart.append("text")
            .attr("x", textX)
            .attr("y", textY)
            .attr("text-anchor", "middle")
            .text(text);
    }

    addText("Pokémon Cards Produced per Artist over Time", chartWidth / 2, -10);
    addText("Year", chartWidth / 2, chartHeight + 38);
    addText("Number of Cards", -chartHeight / 2, -40).attr("transform", "rotate(-90)");

    const xAxis = chart.append("g").attr("transform", `translate(0,${chartHeight})`);
    const yAxis = chart.append("g");

    function drawAxes(duration) {
        const years = x.domain()[1] - x.domain()[0];
        const xTicks = Math.min(10, Math.max(1, Math.floor(years)));

        xAxis.transition().duration(duration)
            .call(d3.axisBottom(x).ticks(xTicks).tickFormat(d3.format("d")));
        yAxis.transition().duration(duration)
            .call(d3.axisLeft(y).tickValues(yTicks));
    }

    drawAxes(0);

    const band = chart.append("g")
        .attr("clip-path", "url(#line-chart-clip)")
        .append("rect")
        .attr("height", chartHeight)
        .attr("fill", "#bae6f7")
        .attr("opacity", 0.85)
        .style("display", "none");

    let bandYears = [];

    function drawBand() {
        if (bandYears.length === 0) {
            band.style("display", "none");
            return;
        }

        const first = d3.min(bandYears);
        const last = d3.max(bandYears);
        const padding = first === last ? 0.4 : 0;
        const left = x(first - padding);
        const bandWidth = Math.max(x(last + padding) - left, 2);

        const wasHidden = band.style("display") === "none";
        band.style("display", null);

        if (wasHidden) {
            band.attr("x", left).attr("width", bandWidth);
        } else {
            band.transition().duration(time).attr("x", left).attr("width", bandWidth);
        }
    }

    const lineGenerator = d3.line()
        .x(point => x(point.year))
        .y(point => y(point.cards));

    function pointsOf(item) {
        return item.values.length === 1 ? [item.values[0], item.values[0]] : item.values;
    }

    function applyStyle(selection, style) {
        return selection
            .attr("stroke", style.stroke)
            .attr("stroke-width", style.width)
            .attr("opacity", style.opacity);
    }

    const lines = chart.selectAll(".artist-line")
        .data(data.artists)
        .enter()
        .append("path")
        .attr("class", "artist-line")
        .attr("clip-path", "url(#line-chart-clip)")
        .attr("d", item => lineGenerator(pointsOf(item)))
        .attr("fill", "none")
        .attr("stroke-linecap", "round")
        .style("cursor", "pointer")
        .on("click", (event, item) => actions.toggleArtist(item.artist));

    applyStyle(lines, styles.normal);

    const label = addText("", chartWidth - 10, 8)
        .attr("text-anchor", "end")
        .attr("fill", "red")
        .style("pointer-events", "none");

    function redraw() {
        drawAxes(time);
        drawBand();
        lines.transition().duration(time).attr("d", item => lineGenerator(pointsOf(item)));
    }

    function zoomTo(selection) {
        const [[left, top], [right, bottom]] = selection;
        const firstYear = x.invert(left);
        const lastYear = x.invert(right);
        const lowest = y.invert(bottom);
        const highest = y.invert(top);

        if (lastYear - firstYear < 1 || highest - lowest <= 0) {
            return;
        }

        x.domain([firstYear, lastYear]);
        y.domain([Math.max(1, lowest), highest]);

        const ticksInside = fullYTicks.filter(tick => tick >= lowest && tick <= highest);
        yTicks = ticksInside.length >= 3
            ? ticksInside
            : d3.ticks(lowest, highest, 5).filter(tick => tick >= 1);

        redraw();
    }

    const brush = d3.brush()
        .extent([[0, 0], [chartWidth, chartHeight]])
        .on("end", function (event) {
            if (!event.selection) {
                return;
            }
            d3.select(this).call(brush.move, null);
            zoomTo(event.selection);
        });

    chart.insert("g", ".artist-line")
        .call(brush)
        .select(".selection")
        .attr("fill-opacity", 0.05)
        .attr("stroke", "red")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,3");

    svg.on("dblclick", function () {
        x.domain(fullX);
        y.domain(fullY);
        yTicks = fullYTicks;
        redraw();
    });

    function update(state) {
        const chosen = new Set(state.artists);
        const background = chosen.size === 0 ? styles.normal : styles.dimmed;

        applyStyle(lines.filter(item => !chosen.has(item.artist)), background);
        applyStyle(lines.filter(item => chosen.has(item.artist)), styles.selected).raise();

        let text = "";
        if (state.artists.length === 1) {
            text = state.artists[0];
        } else if (state.artists.length > 1) {
            text = state.artists.length + " artists selected";
        }
        label.text(text);

        bandYears = state.years;
        drawBand();
    }

    return { update: update };
}