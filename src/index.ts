import Object from '@rbxts/object-utils';

const DataStoreService = game.GetService('DataStoreService');
const HttpService = game.GetService('HttpService');
const Players = game.GetService('Players');
const RunService = game.GetService('RunService');

interface DataMeta {
	assignee: number;
}

interface LoadedData<Data> {
	saveSlot: number;
	cache: Data & DataMeta;
}

/**
 * The base data manager.
 */
export class BaseDataManager<Data extends {}> {
	public datastore = DataStoreService.GetDataStore('PlayerData', '0');
	public defaultPlayerData: Data;
	public queuedSaving: Map<Player, true> = new Map();

	/**
	 * Create a new data manager.
	 * @param defaultPlayerData The default player data - the type of this will be used to construct the autocomplete schemas. Keep in mind that undefined values will only exist in autocomplete! Lua automatically removes nil values from tables.
	 */
	constructor(defaultPlayerData: Data) {
		this.defaultPlayerData = defaultPlayerData;
	}

	public data: Map<Player, LoadedData<Data>> = new Map();

	/**
	 * Prevent the game from closing without saving all data
	 */
	public bindGameClose() {
		if (RunService.IsStudio()) return;

		game.BindToClose(() => {
			wait(5); // wait for the initialization to start

			while (true) {
				if (this.queuedSaving.size() < 0) break;
				wait(1);
			}
		});
	}

	/**
	 * Start the auto save loop.
	 */
	public bindAutoSave() {
		coroutine.wrap(() => {
			while(true) {
				wait(120);
				for (const player of Players.GetPlayers()) {
					this.save(player);
				}
			}
		})();
	}

	/**
	 * Bind to when a player is leaving and their data is not saved yet. This usually means that they've left and have not teleported to another part.
	 * @param preleave The function to call before a player leaves
	 */
	public bindPlayerLeave(preleave?: (player: Player, playerData: Data) => void) {
		Players.PlayerRemoving.Connect(player => {
			const playerData = this.data.get(player);
			if (!playerData) return;

			if (preleave) preleave(player, playerData.cache);
			this.finalSave(player);
		});
	}

	/**
	 * Create a new save for a player
	 * @param player The player to create a save for
	 * @param saveSlot The save slot to create the save in
	 */
	public newSave(player: Player, saveSlot: number) {
		const newData: Data & Partial<DataMeta> = Object.deepCopy(this.defaultPlayerData);
		newData.assignee = player.UserId;

		this.data.set(player, {
			saveSlot: saveSlot,
			cache: newData as Data & DataMeta
		});
	}

	/**
	 * Get the raw string JSON for a save - useful for checking if a save exists, simply check if this is undefined
	 * @param player The player to get the data for
	 * @param saveSlot The save slot to get the json from
	 */
	public getJsonData(player: Player, saveSlot: number): string | undefined {
		const playerDataJson = this.datastore.GetAsync(`${player.UserId}.${saveSlot}`);

		if (!playerDataJson || !typeIs(playerDataJson, 'string')) {
			return undefined;
		}

		return playerDataJson;
	}

	/**
	 * Load the data for a player
	 * @param player The player to load the data for
	 * @param saveSlot The save slot to load the data frrom
	 */
	public loadData(player: Player, saveSlot: number) {
		const playerDataJson = this.getJsonData(player, saveSlot);
		if (!playerDataJson) return false;

		const loadedData: Data & DataMeta = HttpService.JSONDecode(playerDataJson);
		if (loadedData.assignee !== player.UserId) error('Failed data integrity check!');

		this.data.set(player, {
			saveSlot: saveSlot,
			cache: HttpService.JSONDecode(playerDataJson)
		});

		return true;
	}

	/**
	 * Save the player's data
	 * @param player The player to save the data for
	 */
	public save(player: Player) {
		const playerData = this.data.get(player);
		if (!playerData) error('Player was not in global data table!');

		this.datastore.SetAsync(`${player.UserId}.${playerData.saveSlot}`, HttpService.JSONEncode(playerData.cache));
	}

	/**
	 * Save a player's data, and remove them from the cache
	 * @param player The player to save the data for
	 */
	public finalSave(player: Player) {
		this.queuedSaving.set(player, true);

		const playerData = this.data.get(player);
		this.data.delete(player);

		if (!playerData) {
			this.queuedSaving.delete(player);
			error('Player was not in global data table!');
		}

		this.datastore.SetAsync(`${player.UserId}.${playerData.saveSlot}`, HttpService.JSONEncode(playerData.cache));
	}

	/**
	 * Save all players' data
	 */
	public saveAll() {
		for (const player of Players.GetPlayers()) {
			this.save(player);
		}
	}

	/**
	 * Wait for a player's data. This returns undefined if the player left during the process.
	 * @param player The player to wait for
	 */
	public waitForData(player: Player): LoadedData<Data> | undefined {
		const userId = player.UserId;
		let data;

		while (!data) {
			if (!Players.GetPlayerByUserId(userId)) return undefined; // player left while server was trying to load data
			data = this.data.get(player);
			if (!data) wait(1);
		}

		return data;
	}
}