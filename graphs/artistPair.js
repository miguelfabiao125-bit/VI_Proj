function createArtistPair(container, data) {
    let artists = [];
    let index = 0;

    const pair = d3.select(container).append("div").attr("class", "pair");
    const star = pair.append("span").attr("class", "pair-star").text("★");
    const body = pair.append("div").attr("class", "pair-body");
    const frame = body.append("div").attr("class", "pair-frame");
    const starImage = star.append("img").attr("alt", "");
    const tip = star.append("span").attr("class", "pair-tooltip");

    const topArea = d3.select(container.parentNode);
    topArea.selectAll(".pair-info").remove();
    topArea.selectAll(".pair-carousel").remove();

    // Bloco: nome -> total -> setas
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

    const arrowIcon = direction => direction < 0
        ? '<svg viewBox="0 0 10 10"><path d="M7 1 L2 5 L7 9 Z"/></svg>'
        : '<svg viewBox="0 0 10 10"><path d="M3 1 L8 5 L3 9 Z"/></svg>';

    const carousel = info.append("div").attr("class", "pair-carousel");

    carousel.append("button")
        .attr("type", "button")
        .attr("class", "pair-arrow")
        .attr("aria-label", "Previous artist")
        .html(arrowIcon(-1))
        .on("click", () => go(-1));

    const counter = carousel.append("div").attr("class", "pair-count");

    carousel.append("button")
        .attr("type", "button")
        .attr("class", "pair-arrow")
        .attr("aria-label", "Next artist")
        .html(arrowIcon(1))
        .on("click", () => go(1));

    function showMessage(message) {
        frame.classed("empty", true).text(message);
        star.style("visibility", "hidden");
        info.style("display", "none");
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
        name.text(artists[index]);                    // artista que está a ser mostrado
        totalNumber.text(totalCards());               // soma de TODOS os selecionados
        counter.text((index + 1) + " / " + artists.length);
        carousel.style("display", artists.length > 1 ? "flex" : "none");
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