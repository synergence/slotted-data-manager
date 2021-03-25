# @rbxts/slotted-data-manager

**IMPORTANT**: This is a very hands-on process - the data manager does NOTHING behind the scenes without your consent!

To setup:
```ts
import { BaseDataManager } from '@rbxts/slotted-data-manager';

export const dataManager = new BaseDataManager({
    gold: 0,
    class: undefined as undefined | string // this won't be saved in lua, you'll have to manually recreate this when reassigning it
});
```

Now, the data isn't loaded yet - you have to load the player's data. I use TeleportService to send the player's save slot - though you might do it differently. The save slot system is up to you.

```ts
const Players = game.GetService('Players');

interface TeleportData {
    save: number;
}

Players.PlayerAdded.Connect(player => {
    const joinData = player.GetJoinData();

    if (!joinData.TeleportData) {
        player.Kick('Internal error');
        return;
    }

    if (!('save' in joinData.TeleportData)) {
        player.Kick('Internal error');
        return;
    }

    const success = dataManager.loadData(player, (joinData.TeleportData as TeleportData).save);
});
```

Loading data is also manual. To create a new save for a player (recommended index starting from 0, though it'd probably work with indexes starting with 1):
```ts
// You can handle remotes any way you want, but I'm using @rbxts/dispatcher since that's my internal tooling
// .handle is just OnServerInvoke for a RemoteFunction
serverDispatcher.handle('newSave', (player, saveNumber) => {
	if (!typeIs(saveNumber, 'number')) return false;
	if (saveNumber > 4) return false;
	if (saveNumber < 0) return false;

	dataManager.newSave(player, saveNumber);

	return true;
});
```

Retrieving data can be done by one of two methods, depending on your use case:
```ts
Players.PlayerAdded.Connect(player => {
    // when you don't know whether it exists or not, for ex. when it's loading
    const data = dataManager.waitForData(player);
    if (!data) return;

    // do stuff
});

serverDispatcher.handle('getGold', (player) => {
    // when you know it already exists
    const data = dataManager.data.get(player);
    if (!data) return false;

    return data.gold;
});
```

To check if a save exists:
```ts
serverDispatcher.handle('saveExists', (player, saveNumber) => {
    if (!typeIs(saveNumber, 'number')) return false;

	const saveJsonData = dataManager.getJsonData(player, saveNumber); // This will be undefined if nothing is saved here

    return saveJsonData === undefined ? false : true;
});
```

Finally, you'll probably also want functionality such as autosaving, and data loss prevention. These can be enabled by using:

```ts
dataManager.bindGameClose();
dataManager.bindAutoSave();
```