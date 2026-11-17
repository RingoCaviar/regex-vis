import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useLocalStorage } from 'react-use'
import produce from 'immer'
import { useCopyToClipboard } from 'usehooks-ts'
import { Link as LinkIcon, Plus as PlusIcon } from '@phosphor-icons/react'
import { nanoid } from 'nanoid'
import TestItem from '@/components/test-item'
import { genPermalink } from '@/utils/helpers'
import { STORAGE_TEST_CASES } from '@/constants'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { RegexEngine } from '@/regex-engine/evaluate'
import { useRegexTest } from '@/regex-engine/use-regex-test'

type Case = {
  value: string
  id: string
}

type Props = {
  regex: string
  flags: string
  graphError: string | null
}

function TestTab({ regex, flags, graphError }: Props) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [storedEngine, setStoredEngine] = useLocalStorage<RegexEngine>('regex-engine', 'javascript')
  const requestedEngine = searchParams.get('engine') ?? storedEngine
  const engine: RegexEngine = requestedEngine === 'mihomo' ? 'mihomo' : 'javascript'
  const [casesInStorages, setCasesInStorages] = useLocalStorage<string[]>(STORAGE_TEST_CASES, [''])
  const [cases, setCases] = useState<{
    value: string
    id: string
  }[]>(() => casesInStorages?.map(value => ({ value, id: nanoid() })) ?? [])

  const values = useMemo(() => cases.map(({ value }) => value), [cases])
  const response = useRegexTest(engine, regex, flags, values)

  const handleEngineChange = (value: string) => {
    const nextEngine = value === 'mihomo' ? 'mihomo' : 'javascript'
    setStoredEngine(nextEngine)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('engine', nextEngine)
    setSearchParams(nextParams, { replace: true })
  }

  const { toast } = useToast()
  const [, copy] = useCopyToClipboard()

  const saveCases = (cases: Case[]) => {
    setCases(cases)
    setCasesInStorages(cases.map(({ value }) => value))
  }

  const handleCopyPermalink = () => {
    const url = new URL(genPermalink(cases.map(({ value }) => value), flags))
    url.searchParams.set('engine', engine)
    const permalink = url.toString()
    copy(permalink)
    toast({ description: t('Permalink copied.') })
  }

  const handleChange = (value: string, index: number) => {
    saveCases(
      produce(cases!, (draft) => {
        draft[index].value = value
      }),
    )
  }

  const handleRemove = (index: number) => {
    saveCases(
      produce(cases!, (draft) => {
        draft.splice(index, 1)
      }),
    )
  }

  const handleAdd = () => {
    saveCases(
      produce(cases!, (draft) => {
        draft.push({
          value: '',
          id: nanoid(),
        })
      }),
    )
  }

  return (
    <div data-testid="test-tab">
      <div className="space-y-2 mb-6">
        <label htmlFor="regex-engine" className="text-sm font-medium">{t('Matching engine')}</label>
        <Select value={engine} onValueChange={handleEngineChange}>
          <SelectTrigger id="regex-engine" aria-label={t('Matching engine')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="javascript">{t('Default (JavaScript)')}</SelectItem>
            <SelectItem value="mihomo">Clash Verge (Mihomo)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs leading-5 text-muted-foreground">
          {engine === 'mihomo'
            ? t('Tests Mihomo filter expressions. Enter the regex only, without YAML quotes.')
            : t('Tests with the browser JavaScript engine.')}
        </p>
        {graphError && (
          <p className="text-xs leading-5 text-muted-foreground">
            {t('The graph cannot display this syntax. Tests still use the expression you entered.')}
          </p>
        )}
      </div>
      {response?.error && (
        <p role="alert" className="mb-4 text-sm break-words text-destructive">{t(response.error)}</p>
      )}
      <div className="space-y-6">
        {cases!.map(({ value, id }, index) => (
          <React.Fragment key={id}>
            <TestItem
              value={value}
              result={response?.results?.[index]}
              pending={response === null}
              error={!!response?.error}
              onChange={value => handleChange(value, index)}
              onRemove={() => handleRemove(index)}
            />
          </React.Fragment>
        ))}
      </div>
      <div className="flex justify-end space-x-2 mt-4">
        <Button variant="ghost" size="icon" onClick={handleAdd} aria-label={t('Add test case')}>
          <PlusIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleCopyPermalink} aria-label={t('Copy permalink')}>
          <LinkIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default TestTab
