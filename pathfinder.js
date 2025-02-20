const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { GoalFollow, GoalBlock } = goals

const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25000,
    username: 'pathfinder_Bot'
})

bot.loadPlugin(pathfinder)

let mcData 
let followingPlayer = true
let targetBlock = null
let blockGoal = 0
let blocksMined = 0

function locateAndMineBlock() {
    if (blocksMined >= blockGoal) {
        bot.chat(`I have collected ${blockGoal} ${targetBlock}(s)!`)
        followPlayer() 
        return
    }

    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)

    const blockToMine = bot.findBlock({
        matching: (block) => block.name === targetBlock, 
        maxDistance: 32
    })

    if (!blockToMine) {
        bot.chat(`I can't find any more ${targetBlock}(s)!`)
        return
    }

    bot.chat(`Found ${targetBlock} at ${blockToMine.position.x}, ${blockToMine.position.y}, ${blockToMine.position.z}. Moving to mine.`)

    const goal = new GoalBlock(blockToMine.position.x, blockToMine.position.y, blockToMine.position.z)
    bot.pathfinder.setGoal(goal, false)

    bot.once('goal_reached', async () => {
        bot.chat(`Mining ${targetBlock}...`)

        try {
            await bot.dig(blockToMine) 
            blocksMined++
            bot.chat(`Mined ${blocksMined}/${blockGoal} ${targetBlock}(s).`)

            
            locateAndMineBlock()
        } catch (err) {
            bot.chat(`I couldn't mine the ${targetBlock}.`)
            console.error(err)
        }
    })
}

function followPlayer() {
    const player = bot.players['Aquatard22']

    if (!player || !player.entity) {
        bot.chat("I can't see you!")
        return
    }

    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)

    const goal = new GoalFollow(player.entity, 1)
    bot.pathfinder.setGoal(goal, true)
}


function parseMineCommand(message) {
    const parts = message.split(" ") // Split by space
    if (parts.length < 3 || parts[0] !== "mine") return null

    const num = parseInt(parts[1]) // Extract number
    const blockType = parts.slice(2).join("_") // Extract block type

    if (isNaN(num) || num <= 0 || !mcData.blocksByName[blockType]) {
        return null // Invalid input
    }

    return { num, blockType }
}

bot.once('spawn', () => {
    mcData = require('minecraft-data')(bot.version) 
    bot.chat("Bot is ready! ");
    bot.chat("Type 'follow me' to follow you or 'mine <amount> <block_type>' to collect blocks.")
    bot.chat("Type drop <item_id> to drop a specific item")
    bot.chat("Type 'drop all' to drop bot inventory")
    bot.chat("Type 'block ids' to get list of all block id's or fn + f3 then look at block for id name")
    bot.chat("Type 'leave' or 'quit' for bot to leave")
    followPlayer() 
})


function listBlockIds(filter = null) {
    if (!mcData) {
        bot.chat("Bot is still loading, please wait.")
        return
    }

    let blockNames = Object.keys(mcData.blocksByName)

    
    if (filter) {
        blockNames = blockNames.filter(name => name.includes(filter.toLowerCase()))
        if (blockNames.length === 0) {
            bot.chat(`No blocks found matching '${filter}'.`)
            return
        }
    }

    bot.chat(`Total blocks: ${blockNames.length}. Sending list in parts...`)


    const chunkSize = 10
    for (let i = 0; i < blockNames.length; i += chunkSize) {
        bot.chat(blockNames.slice(i, i + chunkSize).join(", "))
    }
}

async function dropAllItems() {
    const items = bot.inventory.items()
    
    if (items.length === 0) {
        bot.chat("I have nothing to drop.")
        return
    }

    bot.chat("Dropping all items...")

    for (const item of items) {
        await bot.tossStack(item)
        bot.chat(`Dropped ${item.count}x ${item.name}`)
    }
}


async function dropSpecificItem(itemName) {
    const items = bot.inventory.items()
    const item = items.find(i => i.name.includes(itemName))

    if (!item) {
        bot.chat(`I don't have any '${itemName}' to drop.`)
        return
    }

    bot.chat(`Dropping ${item.count}x ${item.name}...`)
    await bot.tossStack(item)
}

function help(){
    bot.chat("======================================================")
    bot.chat("'follow me'                  ---- follows player");
    bot.chat("'mine <amount> <block_type>' ---- find and collect blocks.")
    bot.chat("'drop <item_id>'             ---- to drop a specific item")
    bot.chat("'drop all'                   ---- drop bot inventory")
    bot.chat("'block ids'                  ---- list of all block id's") 
    bot.chat("        - or fn + f3 then look at block for id name")
    bot.chat("'leave' or 'quit'            ---- for bot to leave")
    bot.chat("=====================================================")
}

bot.on('chat', async (username, message) => {
    const msg = message.toLowerCase().trim(); 

    switch (true) {
        case msg === 'help':
            help();
            break;

        case msg === 'drop all':
            dropAllItems();
            break;

        case msg.startsWith('drop '):
            dropSpecificItem(msg.slice(5));
            break;

        case msg === 'block ids':
            listBlockIds();
            break;

        case msg.startsWith('block ids '):
            listBlockIds(msg.slice(10));
            break;

        case msg === 'leave' || msg === 'quit':
            bot.quit();
            break;

        case msg === 'follow me':
            followingPlayer = true;
            bot.chat("Following you again.");
            followPlayer();
            break;

        case msg.startsWith('mine'):
            if (!mcData) {
                bot.chat("Bot is still loading, please wait.");
                return;
            }

            const parsed = parseMineCommand(msg);
            if (!parsed) {
                bot.chat("Usage: mine <amount> <block_type>. Example: mine 5 stone");
                return;
            }

            blockGoal = parsed.num;
            targetBlock = parsed.blockType;
            blocksMined = 0;

            bot.chat(`Collecting ${blockGoal} ${targetBlock}(s)!`);
            locateAndMineBlock();
            break;

        default:
            // Handle unrecognized commands if needed
            break;
    }
});
