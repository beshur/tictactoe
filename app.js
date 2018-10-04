/* Tic-Tac-Toe
 *
 * a test game by Alex Buznik, 2018
 * as per DI.fm web developer interview
 */
(function() {
  var TicTacToeApp = function(selector) {
    this.LOG = 'TicTacToe';
    this.log = console.log.bind(console, this.LOG);

    this.$el = selector;
    this.setEvents();
    this.model = new GameModel(this.$el);
    this.model.loadStateAndRun();
  }

  _.extend(TicTacToeApp.prototype, {
    getState: function() {
      return this.model.getState();
    },
    getTemplate: function(tplName) {
      return _.template(TicTacToeTemplates[tplName]);
    },

    setEvents: function() {
      this.$el.on('click', '.playerSelect button', this.onPlayerSelect.bind(this));
      this.$el.on('click', '.gameField > div', this.onTurn.bind(this));
      this.$el.on('click', '.restart', this.onRestart.bind(this));

      this.$el.on('game:mode', this.render.bind(this));
      this.$el.on('game:afterTurn', this.afterTurn.bind(this));
      this.$el.on('game:switchPlayer', this.onSwitchPlayer.bind(this));
    },

    onPlayerSelect: function(event) {
      var player = $(event.target).data('player');
      this.log('onPlayerSelect', player);
      this.model.selectPlayerAndStart(player);
    },

    onSwitchPlayer: function(event, player) {
      this.renderCurrentPlayer(player);
    },

    onRestart: function() {
      this.model.restart();
    },

    onTurn: function(event) {
      if (this.model.getState().mode !== TicTacToeModes.GAME) {
        return;
      }
      var $cellEl = $(event.target);
      var cellIndex = $cellEl.index();
      this.model.onTurn(cellIndex);
    },

    afterTurn: function(event, turn) {
      this.drawTurn(turn);
    },

    drawTurn: function(turn) {
      this.$el.find('.gameField > div').eq(turn.cell)
          .attr('data-player', turn.player);
    },

    render: function() {
      var state = this.model.getState();
      this.log('render', state);
      switch(state.mode) {
        case TicTacToeModes.START:
          this.renderStart(state);
          break;
        case TicTacToeModes.GAME:
          this.renderGame(state);
          break;
        case TicTacToeModes.RESULTS:
          this.renderResults(state);
          break;
        default:
          break;
      }
    },

    renderStart: function(state) {
      this.$el
        .removeClass('gameOver')
        .html(this.getTemplate('wrapper')({
        game: this.getTemplate(state.mode)()
      }));
    },

    renderGame: function(state) {
      this.$el.html(this.getTemplate('wrapper')({
        game: this.getTemplate(state.mode)({
          currentPlayer: this.currentPlayerTpl(state.currentPlayer)
        })
      }));
      this.renderTurns(state.turns);
    },

    renderTurns: function(turns) {
      turns.forEach(this.drawTurn.bind(this));
    },

    renderResults: function(state) {
      var win = this.model.isWin();
      var resultTpl = 'resultsWin';
      if (!win) {
        resultTpl = 'resultsDraw';
      }

      var resultsIn = this.getTemplate(resultTpl)({
        player: state.currentPlayer
      });

      this.$el
        .addClass('gameOver')
        .find('.results')
        .html(this.getTemplate(state.mode)({
          results: resultsIn
        }));
    },

    renderCurrentPlayer: function(currentPlayer) {
      this.$el.find('.currentPlayer')
        .html(this.currentPlayerTpl(currentPlayer));
    },

    currentPlayerTpl: function(currentPlayer) {
      return this.getTemplate('currentPlayer')({
        player: currentPlayer
      })
    }
  });

  var GameModel = function(eventEmitter) {
    this.LOG = 'TicTacToeModel';
    this.log = console.log.bind(console, this.LOG);
    this.resetState();
    this.storageKey = 'gameData';
    this.eventEmitter = eventEmitter;

    return this;
  };

  _.extend(GameModel.prototype, {
    loadStateAndRun: function() {
      var savedState = this.loadState();
      if (this.validateState(savedState)) {
        _.each(this.state, (value, key) => {
          this.state[key] = savedState[key];
        });
      }
      this.log('game start', this.state);
      this.eventEmitter.trigger('game:mode', this.state);
    },

    getState: function() {
      return this.state;
    },

    validateState: function(state) {
      if (!state) {
        return;
      }
      if (!state.currentPlayer) {
        return;
      }
      if (state.mode === TicTacToeModes.RESULTS) {
        return;
      }
      if (state.turns.length >= 9) {
        return;
      }
      return true;
    },

    selectPlayer: function(player) {
      this.state.currentPlayer = player;
    },

    selectPlayerAndStart: function(player) {
      this.selectPlayer(player);
      this.setGameMode(TicTacToeModes.GAME);
    },

    resetState: function() {
      this.state = {
        mode: TicTacToeModes.START,
        turns: [],
        currentPlayer: ''
      }
    },

    restart: function() {
      this.resetState();
      this.setGameMode(TicTacToeModes.START);
    },

    onTurn: function(cellIndex) {
      if (this.state.mode !== TicTacToeModes.GAME) {
        return;
      }
      var checkCell = this.checkCell(cellIndex);
      if (!checkCell) {
        return;
      }

      this.saveTurn(cellIndex);
      var gameOver = this.isGameOver();

      if (gameOver) {
        this.setGameMode(TicTacToeModes.RESULTS);
      } else {
        this.switchPlayer();
      }
    },

    saveState: function() {
      if (localStorage) {
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch(err) {
          this.log('localStorage setItem failed', err);
        }
        return true;
      }
      this.log('localStorage is not available');
      return;
    },

    loadState: function() {
      if (localStorage) {
        var data = localStorage.getItem(this.storageKey);
        var dataJson;
        this.log('loadState', data);
        try {
          dataJson = JSON.parse(data);
        } catch(err) {
          this.log('loadState data is not JSON', err);
          return;
        }
        return dataJson;
      }
      return;
    },

    saveTurn: function(cell) {
      var turn = {
        cell,
        player: this.state.currentPlayer,
        time: Date.now()
      };
      this.state.turns.push(turn);

      this.eventEmitter.trigger('game:afterTurn', turn);

      this.log('turns', this.state.turns);
    },

    switchPlayer: function() {
      this.state.currentPlayer = TicTacToePlayers.find(player => player !== this.state.currentPlayer);
      this.eventEmitter.trigger('game:switchPlayer', this.state.currentPlayer);
      this.saveState();
    },

    checkCell: function(index) {
      return !this.state.turns.find((turn) => {
        return turn.cell === index;
      });
    },

    isGameOver: function() {
      return this.isWin() || this.isDraw();
    },

    isWin: function() {
      var playerTurns = this.state.turns.filter(turn => turn.player === this.state.currentPlayer)
        .map(turn => turn.cell)
        .sort();


      var won = TicTacToeWin.find(win => {
        var playerHasAllWinTurns = _.intersection(win, playerTurns).length >= 3;
        return playerHasAllWinTurns;
      });
      this.log('isWin', playerTurns, 'won', !!won);

      return won;
    },

    isDraw: function() {
      // simple version, not stopping game when no win is possible 
      return this.state.turns.length === 9;
    },

    setGameMode: function(mode) {
      this.state.mode = mode;
      this.saveState();

      this.eventEmitter.trigger('game:mode', this.state);
    },

  });


  var TicTacToeModes = {
    START: 'start', 
    GAME: 'game', 
    RESULTS: 'results'
  };
  var TicTacToePlayers = [ 'x', 'o' ];
  var TicTacToeWin = [
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  var TicTacToeTemplates = {
    wrapper: `<div class="wrapper">
      <h2>Tic-Tac-Toe</h2>

      <div class="game"><%= game %></div>
    </div>`,
    start: `<div class="start">Start as

      <div class="playerSelect">
        <button data-player="x">X</button>
        <button data-player="o">O</button>
      </div>

    </div>`,
    game: `<div class="game">
      <div class="currentPlayer"><%= currentPlayer %></div>
      <div class="results"></div>
      <div class="gameField">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>

      <div class="restart"><button class="restart">Restart game</button></div>

    </div>`,
    currentPlayer: `Current player is <span class="player"><%= player %></span>`,
    results: `<div class="resultsIn">
        <%= results %>
        <div class="restart"><button class="restart">Restart game</button></div>
      </div>`,
    resultsWin: `Player <span class="player"><%= player %></span> won!`,
    resultsDraw: `Tie!`,

  }

  var ticTacToeApp = new TicTacToeApp($('#app'));

})();