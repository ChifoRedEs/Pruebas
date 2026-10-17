class Player {
    constructor(name, color) {
        this.name = name;
        this.color = color;
        this.money = 1500;
        this.position = 0;
        this.properties = [];
        this.inJail = false;
    }
}

class Game {
    constructor() {
        this.players = [new Player("Inversor 1", "#e74c3c"), new Player("Inversor 2", "#3498db")];
        this.currentPlayerIndex = 0;
        this.board = boardSpaces;
    }

    rollDice() {
        return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
    }

    playTurn() {
        let player = this.players[this.currentPlayerIndex];
        let roll = this.rollDice();
        this.log("<strong>" + player.name + "</strong> saca un " + roll + ".");
        
        if (player.inJail) {
            this.log(player.name + " está en la Auditoría. Paga 50M para salir.");
            player.money -= 50;
            player.inJail = false;
        }
        
        let prevPosition = player.position;
        player.position = (player.position + roll) % 40;
        
        // Cobrar al pasar por Ronda de Inversión
        if (player.position < prevPosition) {
            player.money += 200;
            this.log("¡" + player.name + " completa una Ronda de Inversión y cobra 200M!");
        }

        let space = this.board[player.position];
        this.log(player.name + " cae en <strong>" + space.name + "</strong>.");

        if (space.type === "property" || space.type === "railroad" || space.type === "utility") {
            if (!space.owner) {
                if (player.money >= space.price) {
                    let buy = confirm(player.name + ", ¿quieres comprar " + space.name + " por " + space.price + "M?");
                    if(buy) {
                        player.money -= space.price;
                        space.owner = player.name;
                        player.properties.push(space.name);
                        this.log(player.name + " ha comprado " + space.name + ".");
                    }
                } else {
                    this.log(player.name + " no tiene fondos para comprar " + space.name + ".");
                }
            } else if (space.owner !== player.name) {
                let rent = Math.floor(space.price * 0.15); // Alquiler simplificado al 15%
                player.money -= rent;
                let owner = this.players.find(p => p.name === space.owner);
                if(owner) owner.money += rent;
                this.log(player.name + " paga " + rent + "M de regalías a " + space.owner + ".");
            }
        } else if (space.type === "tax") {
            player.money -= space.amount;
            this.log(player.name + " paga " + space.amount + "M por " + space.name + ".");
        }

        if (space.id === 30) {
            player.position = 10;
            player.inJail = true;
            this.log("¡" + player.name + " es enviado directamente a una Auditoría Fiscal!");
        }

        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.updateUI();
    }

    log(msg) {
        let logEl = document.getElementById("log");
        logEl.innerHTML += "<div>" + msg + "</div>";
        logEl.scrollTop = logEl.scrollHeight;
    }

    updateUI() {
        let info = document.getElementById("players-info");
        let htmlArr = [];
        for(let i=0; i<this.players.length; i++) {
            let p = this.players[i];
            let active = (i === this.currentPlayerIndex) ? " (Turno actual)" : "";
            htmlArr.push(
                "<div style='color: " + p.color + "; margin-bottom: 10px; font-size: 15px;'>" +
                "<strong>" + p.name + active + "</strong><br>" +
                "Fondos: " + p.money + "M <br>" +
                "Posición: " + this.board[p.position].name +
                "</div>"
            );
        }
        info.innerHTML = htmlArr.join("<hr style='border:0; border-top:1px solid #ccc;'>");
        if(typeof renderBoard !== 'undefined') renderBoard(this);
    }
}