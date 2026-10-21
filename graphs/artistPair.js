function createArtistPair(container, data) {
    let artists = [];
    let index = 0;

    const pair = d3.select(container).append("div").attr("class", "pair");
    const star = pair.append("span").attr("class", "pair-star").text("★");
    const body = pair.append("div").attr("class", "pair-body");

    const arrowIcon = direction => direction < 0
        ? '<svg viewBox="0 0 10 16"><path d="M8 1.5 L2 8 L8 14.5"/></svg>'
        : '<svg viewBox="0 0 10 16"><path d="M2 1.5 L8 8 L2 14.5"/></svg>';

    const stage = body.append("div").attr("class", "pair-stage");

    const prevArrow = stage.append("button")
        .attr("type", "button")
        .attr("class", "pair-arrow")
        .attr("aria-label", "Previous artist")
        .html(arrowIcon(-1))
        .on("click", () => go(-1));

    const frame = stage.append("div").attr("class", "pair-frame");

    const nextArrow = stage.append("button")
        .attr("type", "button")
        .attr("class", "pair-arrow")
        .attr("aria-label", "Next artist")
        .html(arrowIcon(1))
        .on("click", () => go(1));
    const starImage = star.append("img").attr("alt", "");
    const tip = star.append("span").attr("class", "pair-tooltip");

    const topArea = d3.select(container.parentNode);
    topArea.selectAll(".pair-info").remove();

    const info = topArea.append("div")
        .attr("class", "pair-info")
        .style("display", "none");

    const name = info.append("div").attr("class", "pair-name");

    const totalRow = info.append("div").attr("class", "pair-total-row");
    const totalNumber = totalRow.append("span").attr("class", "pair-total-number");
    totalRow.append("span")
        .attr("class", "pair-total-icon")
        .attr("title", "Cards by the selected artists")
        .html(`
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
                <mask id="pair-total-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
                    <rect width="32" height="32" fill="white"/>
                    <rect x="11" y="6" width="16" height="22" rx="2.5" fill="black" stroke="black" stroke-width="3.5"/>
                </mask>
                <g mask="url(#pair-total-mask)">
                    <rect x="4" y="6" width="16" height="22" rx="2.5" transform="rotate(-14 12 17)"/>
                </g>
                <rect x="11" y="6" width="16" height="22" rx="2.5"/>
                <path d="M19 12 L23 17 L19 22 L15 17 Z"/>
            </svg>
        `);

    const totalNote = info.append("div")
        .attr("class", "pair-total-note")
        .style("display", "none");

    const counter = info.append("div").attr("class", "pair-count");

    function showMessage(message) {
        frame.classed("empty", true).text(message);
        star.style("visibility", "hidden");
        info.style("display", "none");
        prevArrow.style("visibility", "hidden");
        nextArrow.style("visibility", "hidden");
    }

    function showArtist(artist) {
        const favorite = data.cache.mostFamousHighestEarningByArtist.get(artist);
        const bestCard = data.cache.cardsById.get(favorite.cardId);

        frame.classed("empty", false).text("");
        frame.append("img")
            .attr("src", bestCard.image)
            .attr("alt", bestCard.name)
            .attr("title", bestCard.name + " - $" + bestCard.Price)
            .on("error", function () {
                if (!this.dataset.triedFallback && bestCard.imageFallback) {
                    this.dataset.triedFallback = "1";
                    this.src = bestCard.imageFallback;
                    return;
                }
                d3.select(this).remove();
                frame.text("Image unavailable");
            });

        starImage.attr(
            "src",
            data.cache.artistIsMostFrequentForFavoriteCard.get(artist)
                ? "img/estrela_preenchida.png"
                : "img/estrela_vazia.png"
        );

        const details = data.cache.favoriteCardDetailsByArtist.get(artist);

        tip.selectAll("*").remove();
        if (details.isMostFrequent) {
            tip.append("strong").text("★ Signature card");
            tip.append("span").text("No other artist has illustrated more.");
        } else {
            tip.append("strong").text("☆ Shared card");
            tip.append("span").text("Another artist has illustrated more.");
        }

        star.style("visibility", "visible");
    }

    function totalCards() {
        return artists.reduce(function (sum, artist) {
            const ids = data.cache.artistCardIdsByArtist.get(artist);
            return sum + (ids ? ids.length : 0);
        }, 0);
    }

    function render() {
        if (artists.length === 0) {
            showMessage("Click on an Artist");
            return;
        }

        showArtist(artists[index]);

        info.style("display", "flex");
        name.text(artists[index]);                   
        totalNumber.text(totalCards());             
        const many = artists.length > 1;
        counter.text((index + 1) + " / " + artists.length)
            .style("display", many ? null : "none");
        totalNote
            .style("display", many ? null : "none")
            .text("Sum of the cards of the" + artists.length + " artists");
        prevArrow.style("visibility", many ? "visible" : "hidden");
        nextArrow.style("visibility", many ? "visible" : "hidden");
    }

    function go(step) {
        if (artists.length < 2) {
            return;
        }
        index = (index + step + artists.length) % artists.length;
        render();
    }

    function update(state) {
        const previous = artists[index];
        const known = new Set(artists);
        const added = state.artists.find(artist => !known.has(artist));

        artists = state.artists.slice();

        if (added !== undefined) {
            index = artists.indexOf(added);
        } else if (previous !== undefined && artists.includes(previous)) {
            index = artists.indexOf(previous);
        } else {
            index = 0;
        }

        render();
    }

    return { update: update };
}