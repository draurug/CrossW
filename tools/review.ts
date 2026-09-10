/**
 * `npm run review` — что стоит посмотреть глазами.
 *
 * Отдельно от `npm run validate` намеренно. Валидатор — гейт: он говорит «так
 * публиковать нельзя» и обязан быть прав. Здесь живут догадки: они шумят, врут
 * и ничего не запрещают, зато показывают места, где обычно и заводятся дефекты.
 *
 * Каждая проверка здесь появилась после того, как дефект нашёл человек.
 */

import type { Pack } from '../src/core/model'
import { MAX_CLUE_LENGTH } from '../src/core/validate'
import { readPacks } from './content-io'

const YELLOW = '[33m'
const DIM = '[2m'
const GREEN = '[32m'
const OFF = '[0m'

/**
 * Зачины, после которых определение повисает без подлежащего.
 *
 * «Он был четырех, на клочке бумаги» — так выглядел настоящий дефект: фраза
 * начинается с местоимения, которому не на что опереться.
 *
 * Список намеренно короткий. Сначала сюда попали ещё «Тот, кто…», «То, что…»
 * и «Кем…» — и проверка начала ругаться на нормальный русский: «Тот, кто пишет
 * стихи» и «Кем Ватсон служил при полку» безупречны. Проверка, которая кричит
 * впустую, хуже отсутствующей: её перестают читать.
 */
const DANGLING = [/^(Он|Она|Оно|Они)\s/u, /^(Чей|Чья|Чьё|Чье|Чьи)\s/u]

interface Note {
  where: string
  message: string
}

/** Определения с подозрительным зачином. */
function dangling(pack: Pack): Note[] {
  return pack.entries.flatMap((entry) =>
    entry.clues
      .filter((clue) => DANGLING.some((rule) => rule.test(clue.text)))
      .map((clue) => ({ where: entry.answer, message: `зачин повисает: «${clue.text}»` })),
  )
}

/** Длинные определения: лимит калибруется по вёрстке, поэтому не ошибка. */
function longClues(pack: Pack): Note[] {
  return pack.entries.flatMap((entry) =>
    entry.clues
      .filter((clue) => clue.text.length > MAX_CLUE_LENGTH)
      .map((clue) => ({ where: entry.answer, message: `${clue.text.length} символов: «${clue.text}»` })),
  )
}

/** Категории, встретившиеся один раз: обычно это несведённые близкие роды. */
function rareCategories(pack: Pack): Note[] {
  const count = new Map<string, number>()
  for (const entry of pack.entries) {
    if (entry.category === undefined) continue
    count.set(entry.category, (count.get(entry.category) ?? 0) + 1)
  }
  const singles = [...count.entries()].filter(([, n]) => n === 1).map(([name]) => name)
  if (singles.length <= 10) return []
  return [
    {
      where: pack.id,
      message:
        `категорий всего ${count.size}, из них ${singles.length} встречаются один раз` +
        ` — стоит свести близкие: ${singles.slice(0, 8).join(', ')}…`,
    },
  ]
}

const SECTIONS: { title: string; run: (pack: Pack) => Note[] }[] = [
  { title: 'Повисшие зачины', run: dangling },
  { title: 'Длинные определения', run: longClues },
  { title: 'Разнобой в категориях', run: rareCategories },
]

function main(): void {
  const packs = readPacks()
  let total = 0

  for (const pack of packs) {
    console.log(`\n${pack.title} ${DIM}(${pack.id}, ${pack.entries.length} слов)${OFF}`)

    for (const section of SECTIONS) {
      const notes = section.run(pack)
      if (notes.length === 0) continue
      total += notes.length
      console.log(`  ${YELLOW}${section.title}${OFF} ${DIM}— ${notes.length}${OFF}`)
      for (const note of notes.slice(0, 12)) {
        console.log(`    ${note.where.padEnd(14)} ${DIM}${note.message}${OFF}`)
      }
      if (notes.length > 12) console.log(`    ${DIM}…и ещё ${notes.length - 12}${OFF}`)
    }
  }

  console.log()
  if (total === 0) console.log(`${GREEN}Смотреть нечего${OFF}`)
  else console.log(`Мест, требующих взгляда: ${total}. Это не ошибки — решает человек.`)
}

main()
