// Editorial names are deliberately kept separate from the statistics import so
// a season refresh cannot overwrite the bilingual player experience.
const zh = Object.fromEntries(`
Luka Dončić|卢卡·东契奇
Shai Gilgeous-Alexander|谢伊·吉尔杰斯-亚历山大
Anthony Edwards|安东尼·爱德华兹
Jaylen Brown|杰伦·布朗
Tyrese Maxey|泰瑞斯·马克西
Kawhi Leonard|科怀·伦纳德
Donovan Mitchell|多诺万·米切尔
Nikola Jokić|尼古拉·约基奇
Giannis Antetokounmpo|扬尼斯·阿德托昆博
Joel Embiid|乔尔·恩比德
Lauri Markkanen|劳里·马尔卡宁
Stephen Curry|斯蒂芬·库里
Devin Booker|德文·布克
Jalen Brunson|杰伦·布伦森
Kevin Durant|凯文·杜兰特
Jamal Murray|贾马尔·穆雷
Victor Wembanyama|维克托·文班亚马
Deni Avdija|德尼·阿夫迪亚
Michael Porter Jr.|迈克尔·波特
Pascal Siakam|帕斯卡尔·西亚卡姆
Cade Cunningham|凯德·坎宁安
Keyonte George|基扬特·乔治
James Harden|詹姆斯·哈登
Austin Reaves|奥斯汀·里夫斯
Jalen Johnson|杰伦·约翰逊
Paolo Banchero|保罗·班凯罗
Jayson Tatum|杰森·塔图姆
Norman Powell|诺曼·鲍威尔
Trey Murphy III|特雷·墨菲三世
Brandon Ingram|布兰登·英格拉姆
Julius Randle|朱利叶斯·兰德尔
Cooper Flagg|库珀·弗拉格
Zion Williamson|锡安·威廉森
LeBron James|勒布朗·詹姆斯
Shaedon Sharpe|谢登·夏普
Nickeil Alexander-Walker|尼基尔·亚历山大-沃克
Franz Wagner|弗朗茨·瓦格纳
Tyler Herro|泰勒·希罗
Alperen Sengun|阿尔佩伦·申京
Anthony Davis|安东尼·戴维斯
Dillon Brooks|狄龙·布鲁克斯
Brandon Miller|布兰登·米勒
Bam Adebayo|巴姆·阿德巴约
Desmond Bane|德斯蒙德·贝恩
LaMelo Ball|拉梅洛·鲍尔
Karl-Anthony Towns|卡尔-安东尼·唐斯
Jimmy Butler III|吉米·巴特勒
Ty Jerome|泰·杰罗姆
Jalen Duren|杰伦·杜伦
Ja Morant|贾·莫兰特
Jaren Jackson Jr.|小贾伦·杰克逊
RJ Barrett|RJ·巴雷特
Zach LaVine|扎克·拉文
Darius Garland|达里厄斯·加兰
CJ McCollum|CJ·麦科勒姆
Jerami Grant|杰拉米·格兰特
De'Aaron Fox|达龙·福克斯
Kon Knueppel|康·克尼佩尔
DeMar DeRozan|德玛尔·德罗赞
Amen Thompson|阿门·汤普森
Evan Mobley|埃文·莫布利
Scottie Barnes|斯科蒂·巴恩斯
Trae Young|特雷·杨
Jalen Green|杰伦·格林
Saddiq Bey|萨迪克·贝
Bennedict Mathurin|本尼迪克特·马瑟林
Kevin Porter Jr.|小凯文·波特
Coby White|科比·怀特
Paul George|保罗·乔治
Chet Holmgren|切特·霍姆格伦
Miles Bridges|迈尔斯·布里奇斯
Jalen Williams|杰伦·威廉姆斯
Payton Pritchard|佩顿·普里查德
Josh Giddey|乔什·吉迪
Andrew Nembhard|安德鲁·内姆布哈德
Dejounte Murray|德章泰·穆雷
OG Anunoby|OG·阿努诺比
Stephon Castle|斯蒂芬·卡斯尔
Kristaps Porziņģis|克里斯塔普斯·波尔津吉斯
Grayson Allen|格雷森·阿伦
Derrick White|德里克·怀特
Immanuel Quickley|伊曼纽尔·奎克利
Jrue Holiday|朱·霍勒迪
Alex Sarr|亚历克斯·萨尔
Matas Buzelis|马塔斯·布泽利斯
Aaron Gordon|阿隆·戈登
VJ Edgecombe|VJ·埃奇库姆
Domantas Sabonis|多曼塔斯·萨博尼斯
Jabari Smith Jr.|小贾巴里·史密斯
Collin Sexton|科林·塞克斯顿
Andrew Wiggins|安德鲁·维金斯
Jaime Jaquez Jr.|小海梅·哈克斯
Jarrett Allen|贾勒特·阿伦
Naji Marshall|纳吉·马绍尔
Onyeka Okongwu|奥涅卡·奥孔古
Russell Westbrook|拉塞尔·威斯布鲁克
Nikola Vučević|尼古拉·武切维奇
Anthony Black|安东尼·布莱克
Jaden McDaniels|杰登·麦克丹尼尔斯
Ayo Dosunmu|阿约·多孙穆
Mikal Bridges|米卡尔·布里奇斯
Walker Kessler|沃克·凯斯勒
Anfernee Simons|安芬尼·西蒙斯
Scoot Henderson|斯库特·亨德森
P.J. Washington|PJ·华盛顿
Ivica Zubac|伊维察·祖巴茨
Kelly Oubre Jr.|小凯利·乌布雷
Tre Jones|特雷·琼斯
Santi Aldama|桑蒂·阿尔达马
Keegan Murray|基根·穆雷
Devin Vassell|德文·瓦塞尔
Brandin Podziemski|布兰丁·波杰姆斯基
Aaron Nesmith|阿隆·内史密斯
Jalen Suggs|杰伦·萨格斯
De'Andre Hunter|德安德烈·亨特
Bobby Portis Jr.|小鲍比·波蒂斯
Zach Edey|扎克·埃迪
Naz Reid|纳兹·里德
John Collins|约翰·科林斯
Reed Sheppard|里德·谢泼德
Cam Thomas|卡姆·托马斯
Tim Hardaway Jr.|小蒂姆·哈达威
Jordan Poole|乔丹·普尔
Toumani Camara|图马尼·卡马拉
Quentin Grimes|昆廷·格莱姆斯
Tobias Harris|托拜厄斯·哈里斯
Keldon Johnson|凯尔登·约翰逊
Kyle Kuzma|凯尔·库兹马
Jaylen Wells|杰伦·威尔斯
GG Jackson|GG·杰克逊
Deandre Ayton|德安德烈·艾顿
Malik Monk|马利克·蒙克
Max Christie|马克斯·克里斯蒂
Cameron Johnson|卡梅隆·约翰逊
Donte DiVincenzo|丹特·迪文琴佐
Duncan Robinson|邓肯·罗宾逊
Jonathan Kuminga|乔纳森·库明加
Moses Moody|摩西·穆迪
Donovan Clingan|多诺万·克林根
Josh Hart|乔什·哈特
Miles McBride|迈尔斯·麦克布莱德
Christian Braun|克里斯蒂安·布劳恩
Myles Turner|迈尔斯·特纳
Dyson Daniels|戴森·丹尼尔斯
Wendell Carter Jr.|小温德尔·卡特
Klay Thompson|克莱·汤普森
Bilal Coulibaly|比拉尔·库利巴利
Mark Williams|马克·威廉姆斯
Obi Toppin|奥比·托平
Rui Hachimura|八村垒
Max Strus|马克斯·斯特鲁斯
Rudy Gobert|鲁迪·戈贝尔
Jusuf Nurkić|优素福·努尔基奇
Dennis Schröder|丹尼斯·施罗德
Jakob Poeltl|雅各布·珀尔特尔
Jock Landale|乔克·兰代尔
Tari Eason|塔里·伊森
Marvin Bagley III|马文·巴格利三世
Khris Middleton|克里斯·米德尔顿
D'Angelo Russell|丹吉洛·拉塞尔
Precious Achiuwa|普雷舍斯·阿丘瓦
Derrick Jones Jr.|小德里克·琼斯
Kevin Huerter|凯文·赫尔特
Isaiah Stewart|以赛亚·斯图尔特
Harrison Barnes|哈里森·巴恩斯
Ausar Thompson|奥萨尔·汤普森
Royce O'Neale|罗伊斯·奥尼尔
Clint Capela|克林特·卡佩拉
Fred VanVleet|弗雷德·范弗利特
Kyrie Irving|凯里·欧文
Damian Lillard|达米安·利拉德
Tyrese Haliburton|泰瑞斯·哈利伯顿
Kobe Bryant|科比·布莱恩特
Chris Paul|克里斯·保罗
Draymond Green|德雷蒙德·格林
Buddy Hield|巴迪·希尔德
DeMarre Carroll|德马雷·卡罗尔
` .trim().split('\n').map(line => line.split('|')));

export function stablePlayerKey(name) {
  let hash = 2166136261;
  for (const char of String(name).normalize('NFKD').toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `fc-${(hash >>> 0).toString(36)}`;
}

export function enrichPlayer(player) {
  const name = String(player.name || '');
  return {
    ...player,
    nameZh: zh[name] || '',
    playerId: stablePlayerKey(name),
    image: './assets/nba-players/default-player.svg',
  };
}

export const chineseNames = zh;
