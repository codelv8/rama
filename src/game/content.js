/** Original RAMA campaign content. All durations are seconds; rates are per minute. */
export const RESOURCE_NAMES = Object.freeze({ wood: 'ไม้', stone: 'ศิลา', bronze: 'สำริด', rice: 'ข้าว' });
export const RESOURCE_IDS = Object.freeze(Object.keys(RESOURCE_NAMES));

export const BUILDINGS = [
  { id: 'palace', name: 'พระราชวัง', subtitle: 'หัวใจแห่งอโยธยา', description: 'ขยายอาณาจักร เพิ่มความจุคลัง และปลดล็อกสิ่งก่อสร้างระดับสูง', icon: 'crown', baseCost: { wood: 220, stone: 210, bronze: 85, rice: 80 }, duration: 22, maxLevel: 6 },
  { id: 'sawmill', name: 'โรงเลื่อย', subtitle: 'จากผืนป่าสู่เมืองใหญ่', description: 'ผลิตไม้สำหรับก่อสร้างและฝึกกองทัพ อัปเกรดเพื่อเพิ่มผลผลิตต่อเนื่อง', icon: 'trees', resource: 'wood', baseCost: { wood: 75, stone: 55, bronze: 10, rice: 25 }, duration: 12, maxLevel: 6 },
  { id: 'quarry', name: 'เหมืองศิลา', subtitle: 'รากฐานที่แข็งแกร่ง', description: 'ผลิตศิลาสำหรับพระราชวัง กำแพง และสิ่งก่อสร้างในอาณาจักร', icon: 'mountain', resource: 'stone', baseCost: { wood: 85, stone: 55, bronze: 15, rice: 20 }, duration: 14, maxLevel: 6 },
  { id: 'foundry', name: 'โรงหล่อสำริด', subtitle: 'อาวุธแห่งผู้พิทักษ์', description: 'ผลิตสำริดสำหรับเครื่องมือ อาวุธ และทหารระดับสูง', icon: 'flame', resource: 'bronze', baseCost: { wood: 100, stone: 90, bronze: 25, rice: 25 }, duration: 16, maxLevel: 6 },
  { id: 'farm', name: 'นาข้าว', subtitle: 'เลี้ยงเมือง เลี้ยงกองทัพ', description: 'ผลิตข้าวสำหรับฝึกทหารและเสบียงเดินทัพ ทุกการเดินทางเริ่มต้นที่นี่', icon: 'wheat', resource: 'rice', baseCost: { wood: 65, stone: 35, bronze: 5, rice: 35 }, duration: 12, maxLevel: 6 },
  { id: 'barracks', name: 'ค่ายทหาร', subtitle: 'รวมพลผู้กล้า', description: 'ฝึกพลพิทักษ์ พลธนู และทหารวานร ค่ายระดับ 2 ปลดล็อกวานรศึก', icon: 'swords', baseCost: { wood: 120, stone: 100, bronze: 45, rice: 70 }, duration: 18, maxLevel: 6 },
  { id: 'wall', name: 'ประตูนคร', subtitle: 'ปราการแห่งอโยธยา', description: 'เพิ่มขวัญกำลังใจและลดการสูญเสียของทหารในการออกศึก', icon: 'shield', baseCost: { wood: 90, stone: 130, bronze: 35, rice: 25 }, duration: 16, maxLevel: 6 },
  { id: 'market', name: 'ตลาดชุมชน', subtitle: 'เส้นเลือดของเมือง', description: 'เพิ่มความจุทรัพยากรทุกชนิด และเพิ่มผลผลิตทั้งอาณาจักร', icon: 'store', baseCost: { wood: 110, stone: 65, bronze: 30, rice: 65 }, duration: 15, maxLevel: 6 },
  { id: 'shrine', name: 'เทวสถาน', subtitle: 'พรแห่งหิมพานต์', description: 'เพิ่มพลังวีรชนและลดการสูญเสียของกองทัพในการเดินทาง', icon: 'sparkles', baseCost: { wood: 90, stone: 120, bronze: 60, rice: 70 }, duration: 20, maxLevel: 6 },
];

export const TROOPS = [
  { id: 'guardian', name: 'พลพิทักษ์', title: 'แนวหน้าผู้กล้า', description: 'ทหารราบที่ฝึกได้รวดเร็ว เป็นกำลังหลักของอาณาจักร', icon: 'shield', attack: 12, defense: 14, baseCost: { wood: 16, stone: 0, bronze: 7, rice: 20 }, trainingSeconds: 5, unlockBarracks: 1 },
  { id: 'archer', name: 'พลธนู', title: 'ศรแห่งอโยธยา', description: 'กองหนุนระยะไกลที่สร้างพลังโจมตีสูง ใช้ไม้ในการฝึกมากขึ้น', icon: 'bow', attack: 18, defense: 8, baseCost: { wood: 24, stone: 0, bronze: 9, rice: 22 }, trainingSeconds: 6, unlockBarracks: 1 },
  { id: 'vanara', name: 'วานรศึก', title: 'นักรบแห่งพงไพร', description: 'หน่วยชั้นสูงที่มีพลังและความคล่องตัว ต้องมีค่ายทหารระดับ 2', icon: 'zap', attack: 32, defense: 20, baseCost: { wood: 25, stone: 10, bronze: 22, rice: 35 }, trainingSeconds: 7, unlockBarracks: 2 },
];

export const HEROES = [
  {
    id: 'rama', name: 'พระราม', title: 'ผู้พิทักษ์แห่งอโยธยา', faction: 'อโยธยา', role: 'สมดุล', available: true,
    description: 'ผู้นำผู้ถือคันศร พัฒนาอาณาจักรด้วยพลังและประสบการณ์ที่กองทัพสั่งสมร่วมกัน',
    lore: 'ในเรื่องราวของ RAMA พระรามเริ่มต้นการเดินทางจากเมืองเล็ก ๆ และรวมเหล่าผู้กล้าเพื่อคืนความสงบให้หิมพานต์ ทุกชัยชนะเป็นก้าวต่อไปของทั้งอาณาจักร',
    ability: { name: 'ศรแห่งปณิธาน', description: 'ใช้ค่าความสามารถที่พัฒนาร่วมกัน ไม่มีโบนัสประจำตัวเพิ่มเติม' },
    bonuses: { attack: 0, defense: 0, fortune: 0 },
  },
  {
    id: 'hanuman', name: 'หนุมาน', title: 'ทหารเอกแห่งวานร', faction: 'ขีดขิน', role: 'ตำนาน', available: false,
    description: 'สหายแห่งตำนาน ภาพประกอบวีรชนสำหรับอาณาจักร',
    lore: 'วานรเผือกผู้กล้าเป็นสัญลักษณ์ของไหวพริบและความมุ่งมั่น ใน RAMA รุ่นนี้ หนุมานอยู่ในสมุดภาพตำนานและยังเลือกนำทัพไม่ได้',
    ability: { name: 'สมุดภาพตำนาน', description: 'ตัวละครประกอบเรื่องราว ยังไม่มีโบนัสที่ใช้ในการรบ' },
    bonuses: { attack: 0, defense: 0, fortune: 0 },
  },
  {
    id: 'thotsakan', name: 'ทศกัณฐ์', title: 'จอมราชาแห่งลงกา', faction: 'ลงกา', role: 'ตำนาน', available: false,
    description: 'คู่ปรับในแคมเปญหิมพานต์ นำทัพผ่านด่านเพื่อไปถึงนครลงกา',
    lore: 'นครลงกาคือปลายทางของแคมเปญและบททดสอบของอาณาจักร ทศกัณฐ์เป็นตัวละครในสมุดภาพตำนานของ RAMA รุ่นนี้และยังเลือกนำทัพไม่ได้',
    ability: { name: 'สมุดภาพตำนาน', description: 'ตัวละครประกอบเรื่องราว ยังไม่มีโบนัสที่ใช้ในการรบ' },
    bonuses: { attack: 0, defense: 0, fortune: 0 },
  },
  // Passive abilities below are original RAMA game rules, not claims about canonical powers.
  {
    id: 'lakshman', name: 'พระลักษมณ์', title: 'ศรคู่แห่งอโยธยา', faction: 'อโยธยา', role: 'โจมตี', available: true,
    description: 'นักธนูผู้สุขุม เพิ่มพลังแนวรบพร้อมดูแลการป้องกันและเสบียงที่นำกลับเมือง',
    lore: 'พระลักษมณ์ในเรื่องราวของ RAMA คอยประคองแนวรบให้เดินหน้าอย่างเป็นระเบียบ ความแม่นยำและความรอบคอบของเขาทำให้กองทัพพร้อมรับทั้งโอกาสและอุปสรรค',
    ability: { name: 'ศรประสาน', description: 'โบนัสประจำตัว: โจมตี +2 · ป้องกัน +1 · โชคลาภ +1' },
    bonuses: { attack: 2, defense: 1, fortune: 1 },
    portrait: { src: '/art/hero-expansion-a.webp', columns: 3, rows: 2, column: 0, row: 0 },
  },
  {
    id: 'sita', name: 'นางสีดา', title: 'หัวใจแห่งอโยธยา', faction: 'อโยธยา', role: 'สนับสนุน', available: true,
    description: 'เสริมขวัญกำลังใจและการดูแลเสบียง เพิ่มทรัพยากรจากชัยชนะพร้อมช่วยลดความสูญเสีย',
    lore: 'ในเรื่องราวของ RAMA นางสีดาให้ความสำคัญกับชีวิตผู้คนและสิ่งที่กองทัพนำกลับบ้าน การเดินทางของเธอจึงมุ่งสร้างความหวังและความมั่นคงให้เมือง',
    ability: { name: 'ขวัญแห่งนคร', description: 'โบนัสประจำตัว: ป้องกัน +1 · โชคลาภ +3' },
    bonuses: { attack: 0, defense: 1, fortune: 3 },
    portrait: { src: '/art/hero-expansion-a.webp', columns: 3, rows: 2, column: 1, row: 0 },
  },
  {
    id: 'sugriva', name: 'สุครีพ', title: 'แม่ทัพแห่งขีดขิน', faction: 'ขีดขิน', role: 'ป้องกัน', available: true,
    description: 'ผู้นำแนวรับที่ช่วยรักษากำลังทหาร พร้อมเสริมพลังโจมตีให้กองทัพเล็กน้อย',
    lore: 'สุครีพในเรื่องราวของ RAMA เชื่อว่ากองทัพที่กลับบ้านได้มากคือกำลังของวันพรุ่งนี้ เขาจัดแนวรบด้วยความรอบคอบและให้ทุกหน่วยคอยช่วยเหลือกัน',
    ability: { name: 'แนวรบขีดขิน', description: 'โบนัสประจำตัว: โจมตี +1 · ป้องกัน +3' },
    bonuses: { attack: 1, defense: 3, fortune: 0 },
    portrait: { src: '/art/hero-expansion-a.webp', columns: 3, rows: 2, column: 2, row: 0 },
  },
  {
    id: 'angada', name: 'องคต', title: 'ผู้กล้าแห่งแนวหน้า', faction: 'ขีดขิน', role: 'โจมตี', available: true,
    description: 'นำกองทัพรุกคืบด้วยพลังโจมตีสูงและการป้องกันเสริม เหมาะกับการเปิดพื้นที่ใหม่',
    lore: 'องคตในเรื่องราวของ RAMA พร้อมก้าวเข้าสู่เส้นทางที่คนอื่นยังลังเล เขาใช้ความกล้าหาญเปิดทาง แต่ยังคอยประคองเพื่อนร่วมทัพให้ตามมาได้อย่างปลอดภัย',
    ability: { name: 'ก้าวนำผู้กล้า', description: 'โบนัสประจำตัว: โจมตี +3 · ป้องกัน +1' },
    bonuses: { attack: 3, defense: 1, fortune: 0 },
    portrait: { src: '/art/hero-expansion-a.webp', columns: 3, rows: 2, column: 0, row: 1 },
  },
  {
    id: 'jambavan', name: 'ชมพูพาน', title: 'ผู้คุมแนวทัพ', faction: 'ขีดขิน', role: 'ป้องกัน', available: true,
    description: 'ขุนพลผู้มากประสบการณ์ เน้นลดการสูญเสียเพื่อให้กำลังทหารพร้อมสำหรับการเดินทางครั้งต่อไป',
    lore: 'ชมพูพานในเรื่องราวของ RAMA จดจำบทเรียนจากทุกการเดินทาง เขาคอยจัดระเบียบกองทัพและรักษาแนวรับเมื่อหน่วยอื่นต้องการเวลาตั้งหลัก',
    ability: { name: 'แนวรับมั่นคง', description: 'โบนัสประจำตัว: ป้องกัน +4' },
    bonuses: { attack: 0, defense: 4, fortune: 0 },
    portrait: { src: '/art/hero-expansion-a.webp', columns: 3, rows: 2, column: 1, row: 1 },
  },
  {
    id: 'nilaphat', name: 'นิลพัท', title: 'นักรบแห่งรัตติกาล', faction: 'ขีดขิน', role: 'สมดุล', available: true,
    description: 'ประสานพลังโจมตีกับแนวรับอย่างสมดุล เหมาะกับทัพที่ต้องการความพร้อมทั้งสองด้าน',
    lore: 'นิลพัทในเรื่องราวของ RAMA สังเกตจังหวะก่อนเข้าปะทะเสมอ เขารู้ว่าเมื่อใดควรรุกและเมื่อใดควรรักษาแนว จึงพากองทัพผ่านเส้นทางที่ไม่แน่นอนได้อย่างมั่นใจ',
    ability: { name: 'จังหวะรุกและรับ', description: 'โบนัสประจำตัว: โจมตี +2 · ป้องกัน +2' },
    bonuses: { attack: 2, defense: 2, fortune: 0 },
    portrait: { src: '/art/hero-expansion-a.webp', columns: 3, rows: 2, column: 2, row: 1 },
  },
  {
    id: 'vibhishana', name: 'พิเภก', title: 'ที่ปรึกษาแห่งกองทัพ', faction: 'พันธมิตร', role: 'สนับสนุน', available: true,
    description: 'วางแผนการเดินทางให้รอบคอบ ลดความสูญเสียและเพิ่มทรัพยากรที่กองทัพนำกลับมา',
    lore: 'พิเภกในเรื่องราวของ RAMA รวบรวมข้อมูลจากผู้เดินทางแล้วช่วยชี้ทางเลือกแก่กองทัพ การวางแผนของเขาให้ความสำคัญกับความพร้อมและผลลัพธ์ระยะยาว',
    ability: { name: 'แผนการที่รอบคอบ', description: 'โบนัสประจำตัว: ป้องกัน +2 · โชคลาภ +2' },
    bonuses: { attack: 0, defense: 2, fortune: 2 },
    portrait: { src: '/art/hero-expansion-b.webp', columns: 2, rows: 2, column: 0, row: 0 },
  },
  {
    id: 'garuda', name: 'พญาครุฑ', title: 'ผู้กล้าแห่งเวหา', faction: 'หิมพานต์', role: 'โจมตี', available: true,
    description: 'เสริมพลังโจมตีของกองทัพเต็มกำลัง เหมาะกับการฝ่าแนวศัตรูที่มีพลังรบสูง',
    lore: 'พญาครุฑในเรื่องราวของ RAMA มองเส้นทางจากมุมสูงและเลือกจุดรุกคืบอย่างเด็ดขาด การปรากฏตัวของเขาปลุกความกล้าให้ทหารพร้อมก้าวผ่านปราการตรงหน้า',
    ability: { name: 'แนวรุกเวหา', description: 'โบนัสประจำตัว: โจมตี +4 โดยไม่เปลี่ยนระยะเวลาเดินทาง' },
    bonuses: { attack: 4, defense: 0, fortune: 0 },
    portrait: { src: '/art/hero-expansion-b.webp', columns: 2, rows: 2, column: 1, row: 0 },
  },
  {
    id: 'suphannamatcha', name: 'นางสุพรรณมัจฉา', title: 'ผู้พิทักษ์สายน้ำ', faction: 'สายน้ำ', role: 'สนับสนุน', available: true,
    description: 'เพิ่มทรัพยากรที่ได้รับจากชัยชนะ เหมาะกับการออกสำรวจเพื่อพัฒนาเศรษฐกิจของเมือง',
    lore: 'นางสุพรรณมัจฉาในเรื่องราวของ RAMA รู้จักเส้นทางริมน้ำและการลำเลียงเสบียง เธอช่วยให้สิ่งที่กองทัพรวบรวมได้กลับถึงอาณาจักรอย่างคุ้มค่า',
    ability: { name: 'เสบียงแห่งสายน้ำ', description: 'โบนัสประจำตัว: โชคลาภ +4' },
    bonuses: { attack: 0, defense: 0, fortune: 4 },
    portrait: { src: '/art/hero-expansion-b.webp', columns: 2, rows: 2, column: 0, row: 1 },
  },
  {
    id: 'macchanu', name: 'มัจฉานุ', title: 'ผู้ลาดตระเวนแห่งธารา', faction: 'สายน้ำ', role: 'สมดุล', available: true,
    description: 'สนับสนุนทั้งการรบและการเก็บเสบียง เพิ่มพลังโจมตี ป้องกัน และรางวัลจากการเดินทาง',
    lore: 'มัจฉานุในเรื่องราวของ RAMA คอยสำรวจเส้นทางก่อนกองทัพออกเดินทาง เขามุ่งให้เพื่อนร่วมทัพรับมืออุปสรรคได้และนำเสบียงกลับเมืองมากขึ้น',
    ability: { name: 'เส้นทางสองพิภพ', description: 'โบนัสประจำตัว: โจมตี +1 · ป้องกัน +1 · โชคลาภ +2' },
    bonuses: { attack: 1, defense: 1, fortune: 2 },
    portrait: { src: '/art/hero-expansion-b.webp', columns: 2, rows: 2, column: 1, row: 1 },
  },
];

export const QUESTS = [
  { id: 'foundation', title: 'รากฐานอาณาจักร', description: 'อัปเกรดสิ่งก่อสร้างสำเร็จ 1 ครั้ง', metric: 'upgrades', target: 1, reward: { wood: 150, stone: 120, bronze: 40, rice: 150 }, xp: 25 },
  { id: 'recruit', title: 'รวบรวมผู้กล้า', description: 'ฝึกทหารสำเร็จรวม 6 นาย', metric: 'trained', target: 6, reward: { wood: 180, stone: 120, bronze: 90, rice: 250 }, xp: 30 },
  { id: 'first-victory', title: 'ก้าวแรกสู่หิมพานต์', description: 'ออกสำรวจและชนะการศึก 1 ครั้ง', metric: 'victories', target: 1, reward: { wood: 220, stone: 180, bronze: 110, rice: 280 }, xp: 45 },
  { id: 'growth', title: 'นครที่รุ่งเรือง', description: 'พัฒนาพระราชวังถึงระดับ 3', metric: 'palace', target: 3, reward: { wood: 350, stone: 350, bronze: 180, rice: 400 }, xp: 60 },
  { id: 'campaign', title: 'เส้นทางผู้พิทักษ์', description: 'พิชิตพื้นที่บนแผนที่โลก 3 แห่ง', metric: 'completedNodes', target: 3, reward: { wood: 500, stone: 450, bronze: 260, rice: 600 }, xp: 80 },
  { id: 'liberation', title: 'ตำนานบทใหม่', description: 'พิชิตนครลงกาและจบแคมเปญ', metric: 'lanka', target: 1, reward: { wood: 1000, stone: 1000, bronze: 700, rice: 1200 }, xp: 150 },
];

export const WORLD_NODES = [
  { id: 'grove', name: 'ป่าหิมพานต์', subtitle: 'เสียงเรียกจากพงไพร', description: 'เปิดเส้นทางป่าและนำทรัพยากรกลับสู่เมือง เหมาะกับกองทัพเริ่มต้น', kind: 'forest', x: 25, y: 64, threat: 150, duration: 25, minPalace: 1, reward: { wood: 240, stone: 80, bronze: 25, rice: 180 }, xp: 35 },
  { id: 'river', name: 'ท่าน้ำสุพรรณ', subtitle: 'เส้นทางแห่งสายน้ำ', description: 'ปกป้องท่าน้ำเพื่อเปิดเส้นทางเสบียงของอโยธยา', kind: 'river', x: 43, y: 75, threat: 240, duration: 30, minPalace: 2, reward: { wood: 180, stone: 200, bronze: 60, rice: 320 }, xp: 45 },
  { id: 'outpost', name: 'ค่ายอสูร', subtitle: 'เงามืดที่ชายแดน', description: 'ทัพอสูรตั้งมั่นอยู่ที่ชายแดน เตรียมกำลังเสริมก่อนเข้าปะทะ', kind: 'camp', x: 55, y: 48, threat: 350, duration: 35, minPalace: 2, reward: { wood: 260, stone: 300, bronze: 180, rice: 350 }, xp: 55 },
  { id: 'valley', name: 'หุบเขาวานร', subtitle: 'พันธมิตรในขุนเขา', description: 'ผ่านแนวหุบเขาและช่วยปลดปล่อยเส้นทางของเหล่าวานร', kind: 'mountain', x: 35, y: 29, threat: 520, duration: 40, minPalace: 3, reward: { wood: 400, stone: 450, bronze: 260, rice: 500 }, xp: 70 },
  { id: 'fortress', name: 'ป้อมมหาอสูร', subtitle: 'ปราการสุดท้าย', description: 'ป้อมหน้าด่านแห่งลงกา ต้องใช้กองทัพที่เติบโตและวีรชนที่พร้อมรบ', kind: 'fortress', x: 72, y: 31, threat: 750, duration: 45, minPalace: 3, reward: { wood: 550, stone: 600, bronze: 400, rice: 650 }, xp: 90 },
  { id: 'lanka', name: 'นครลงกา', subtitle: 'บทสุดท้ายของตำนาน', description: 'นำทัพสู่ชัยชนะครั้งสุดท้ายเพื่อคืนความสงบให้แผ่นดิน', kind: 'citadel', x: 79, y: 62, threat: 1100, duration: 60, minPalace: 3, reward: { wood: 900, stone: 900, bronze: 650, rice: 1000 }, xp: 140 },
];
