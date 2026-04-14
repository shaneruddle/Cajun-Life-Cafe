import fs from 'node:fs';
import path from 'node:path';

const urls = [
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1729921751658x699280217978416800/S__51126308.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1729920619960x862699874723890300/S__51126304.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719648457452x564113215036428540/Americano.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717493966493x675749604839143800/garlic-bread-1.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1742008535554x328060081503198000/New%20Greek%20Salad.png",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532616025x124063767790263840/English-breakfast.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717533125910x888604589393150200/cajun-grilled-chicken-ceasar-wrap.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1732860885389x561253173064308000/Fajita%20wrap%20with%20fries%202.png",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743086184447x830239978787843400/alpaca-cabernet-merlot-b.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719648487943x945106965882924900/espresso.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532921024x621623799811867000/cajun-fried-shrimp-plate.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1729921105366x803436691358807600/S__51126307.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743155032196x602397166234101000/Peanut%20butter%20cup%203.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1729515406477x807020722615237800/S__50978826.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1730988597986x826326169411704000/Smoked%20Salmon%20Wrap.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743086279320x869346049573124900/glass%20red%20wine%202.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1774414013474x972136837065388700/piccolo%20coffee%201.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717490067404x463109730087793340/Lemon-Cream-Pie-Smoothie-Bowl.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719648396809x477268206356771700/cappuccino%20Ice.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717494111627x396154154843842560/spring-rolls-1.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532623811x338148181501526140/healthy-omega-breakfast.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532963888x874174627026788200/teriyaki-chcken-tasta.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719660134427x453723798922391700/Apple%20Cinnamon%20Cake.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743085956831x679496818347604900/Syrah%20de%20Pennautier.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717489936039x911077553632685200/Blueberry-Mango.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717490021197x874430998017274000/Blueberry-Orange-Banana.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719648473556x138107565423948530/latte.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717494060658x960403830200636800/bruschetta-1.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717494191847x578403522233411800/homestyle-onion-rings-1.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1742010093685x230033200474918140/new%20Ceasar%20%20Salad%20with%20Chicken.webp",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1742009342013x220125177027877820/New%20chicken%20Mango%20Avocado%20Salad%20%281%29.webp",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532670627x785829895397834200/pancakes.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532959635x888999752841108200/chicken-pesto-pasta.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743086048433x485522080994103400/glass%20red%20wine%202.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719648519686x878762460464874100/mocha.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717494253876x880474122025723500/sweet-potato-fries-1.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717495959082x182034649444905900/caesar-salad-with-smoked-salmon.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717496023915x301164314986801300/salmon-avocado-quinoa-salad.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532674462x852298003988116200/pancakes-smoked.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532950310x266707059567936600/shrimp-etouffee.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532974248x654244660582563200/cajun-grilled-chicken.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1729935471607x423892153281590300/S__51150867.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1729573216877x136720940586783740/Screenshot%202024-10-22%20120003.png",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743086408473x793873317287008300/alpaca-chardonnay-.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1760507275969x316681118685410800/Cajun%20Chicken%20and%20Pumpkin%20Salad.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717490084522x709736144904784560/Chocolate-Almond-Peanut-Butter.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659804829x841885568208144800/dark-chocolate-banana.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659776715x499044450134297400/Chocolate%20Peanut%20Butter.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659880119x332802306511285300/Vanilla%20Berry.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659901594x368357753964567040/Yellow%20Protein.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719648243429x136939071363912930/36ceab2c-a307-41d4-ac74-f0d8567bebcd.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717494164463x814019203606606100/calamari-1.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717494280217x953287005611645300/French-fries-1.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717496052962x686903693612967000/Cobb-Salad-1.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532633299x509382496051078400/eggs-benedict.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532937609x670905867705042600/pastalaya.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717533097030x341437697749293250/chicken-fajita.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1729935548057x357118924620572800/S__51150869.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1734591632468x914236329420306700/Mixed%20vegetable%20chicken.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1734591856011x494403984761832450/Stir%20fried%20pork%20garlic.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1761277772283x320535949918012740/Stir%20fried%20basil%202.JPG",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1737988935676x779459914259929200/Thai%20Tea%20Milk%202.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1737989081288x782026847231243000/Green%20Tea%20Milk%202.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743086526544x956298886982895000/glass%20white%20wine.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1771584113355x653236683373200900/Blue%20Glow%20Smoothie.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717490300460x804933415119993900/pineapple-orange-mango.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719648192444x835936912850831100/a488616d-5cc3-423a-90fd-4090f697a55d.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717495887140x910768046628825100/tomato-soup-1.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532639533x684317997647177000/eggs-royal.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532931130x926067402285734300/cajun-spicy-cornbread.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717533092715x711462339673515500/beef-tenderloin-fajita1.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743086821658x341628318699119170/sauvignon-blanc-b.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1774253395732x974753485678394600/Ube%20latte%20ice%202.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717490348883x358995149494354000/strawberry-banana.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717494378796x133620615895454050/onion-soup-1.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532644456x462901230657480450/eggs-florentine.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532971805x103962879139453340/cajun-grilled-chicken-breast.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1733731547600x190795621300065000/Lemon%20Tea.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1739950471706x420771916850619700/Chicken%20Avocado%20Burger.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743086960354x654506792376766500/glass%20white%20wine.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717490320723x147660235215991260/blueberry-banana.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717494398668x270872668163797400/pumpkin-soup-1.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532663357x444549764317806660/cajun-eggs-benedict.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1738734217402x285345955992508670/Coconut%20soup%20with%20chicken.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719658768619x140286396964935060/Earl%20grey.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743087070160x154074614068485440/gris-blanc-rose-b.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717490386289x442685595194572900/mango-passion-fruit.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532652118x606420027133484500/Breakfast-Wrap.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532987338x497151307027175360/cajun-grilled-salmon.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1758351736138x964782988209610400/Green%20Curry%20with%20chicken.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719658782340x594993332513516800/English%20Breakfast.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1740550000053x414936961027130500/Chicken%20Fried%20Burger.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1740999880327x893166390141958000/Beef%20Cheese%20Burger.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1743087107631x194451731636781760/Rose%20wine.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532656398x491947931729489660/Breakfast-muffin.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532997382x697219427743747300/cajun-grilled-beef-steak.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719658829237x610420263593233900/Jasmin%20Green%20Tea.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1748065229609x685555330006141000/Rose%20wine%20La%20Vieille%20Ferme.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532750241x402474963592511360/egg-white-omelet.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532679337x248910052610629600/oats-fruit.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532729558x310796501130013760/norwegian-breakfast.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532993931x547496169924012400/cajun-grilled-tuna-steak.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719658849132x532735127667376400/Japanese%20Green%20Tea.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1748065085687x971098557527171300/Rose%20wine.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659487217x895559368032370400/Orange%20Juice.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1717532722629x475336386818056700/oats-fruit.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659470329x116852175969753170/Pineapple.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659476482x772629758210704300/Lime%20juice.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659504892x436482040628726660/Hight%20-%20C.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659529814x752832364542344300/Lemon%20Ginger.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659525086x637805095971587100/Feeling%20Good.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659512930x335644762398343000/Tropical%20Green.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1748694869908x147333063227642850/Protein%20Pancake.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719659518519x459156569382335900/Tomato%20Kiss.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719658900897x762293967159004500/Coconut.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719658510036x728237926490501500/Mango%20Soda.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719657663185x908014403773048200/Passion%20Fruit.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719657628992x758578854433291900/Strawberry%20Soda.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719657602509x666638469676950500/blue%20hawaii.jpg",
  "https://533d0a6dd397f4a13f07e3dd9a70a33a.cdn.bubble.io/f1719657555643x441982006900105900/Lychee%20Soda.jpg",
  "https://d3ad822823e9872b234136cdf10eb5b6.cdn.bubble.io/f1759202069126x892742509907711700/Stir%20Fried%20Asparagus%20with%20Shrimp.jpg"
];

const dir = './public/menu';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

async function download(url) {
  try {
    const filename = url.split('/').pop();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(path.join(dir, filename), buffer);
    console.log(`Downloaded ${filename}`);
  } catch (err) {
    console.error(`Error downloading ${url}:`, err.message);
  }
}

async function run() {
  for (const url of urls) {
    await download(url);
  }
}

run();
