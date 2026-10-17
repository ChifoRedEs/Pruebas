const game = new Game();

function initBoard() {
    let boardEl = document.getElementById("board");
    // Crear la matriz de 11x11 (121 celdas) vacía
    for (let i = 0; i < 121; i++) {
        let div = document.createElement("div");
        boardEl.appendChild(div);
    }
    renderBoard(game);
}

function renderBoard(gameInstance) {
    let boardEl = document.getElementById("board");
    let cells = Array.from(boardEl.children);
    cells.forEach(c => { c.className = ""; c.innerHTML = ""; c.style.visibility = "hidden"; });

    // Mapeo del circuito al perímetro del Grid de 11x11
    let positions = [];
    for(let i=10; i>=0; i--) positions.push(110 + i);    // Fila inferior (Casillas 0-10)
    for(let i=9; i>=1; i--) positions.push(i*11);        // Columna Izquierda (Casillas 11-19)
    for(let i=0; i<=10; i++) positions.push(i);          // Fila superior (Casillas 20-30)
    for(let i=1; i<=9; i++) positions.push(i*11 + 10);   // Columna Derecha (Casillas 31-39)

    gameInstance.board.forEach((space, idx) => {
        let gridIndex = positions[idx];
        let cell = cells[gridIndex];
        cell.style.visibility = "visible";
        cell.className = "space " + (space.type === 'corner' ? 'corner' : '');
        
        let content = "<span style='margin-top: 15px; z-index:2'>" + space.name + "</span>";
        if(space.color) {
            content += "<div class='color-bar' style='background: " + space.color + "'></div>";
        }
        if(space.price) {
            content += "<span class='price'>" + space.price + "M</span>";
        }
        
        // Indicador de propiedad
        if(space.owner) {
            let owner = gameInstance.players.find(p => p.name === space.owner);
            content += "<div style='position:absolute; top:20px; right:2px; width:8px; height:8px; border-radius:50%; background:" + owner.color + "'></div>";
        }
        
        cell.innerHTML = content;
    });

    // Renderizar fichas de los jugadores
    gameInstance.players.forEach(p => {
        let gridIndex = positions[p.position];
        let cell = cells[gridIndex];
        let randomOffset = Math.floor(Math.random() * 40) + 10;
        cell.innerHTML += "<div class='player-token' style='background: " + p.color + "; left: " + randomOffset + "px'></div>";
    });
}

document.getElementById("roll-dice").addEventListener("click", () => {
    game.playTurn();
});

window.onload = () => {
    initBoard();
    game.updateUI();
};