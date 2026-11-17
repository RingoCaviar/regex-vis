import { useTranslation } from 'react-i18next'
import { Check as CheckIcon, Trash as TrashIcon, X as XIcon } from '@phosphor-icons/react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

type Props = {
  value: string
  result?: boolean
  pending: boolean
  error: boolean
  onChange: (value: string) => void
  onRemove: () => void
}

function TestItem({ value, result, pending, error, onChange, onRemove }: Props) {
  const { t } = useTranslation()
  const status = pending ? 'Testing…' : error ? 'Unable to test' : result ? 'Matches' : 'No match'

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
  }

  return (
    <div className="focus-within:outline-none focus-within:ring-1 focus-within:ring-ring rounded-md">
      <Textarea
        defaultValue={value}
        onChange={onChange}
        className="rounded-b-none"
        onKeyDown={onKeyDown}
        aria-label={t('Test text')}
      />
      <div className="border border-t-0 rounded-b-md flex justify-between items-center pl-4 bg-muted">
        <span role="status" className="inline-flex items-center gap-2 text-xs">
          {!pending && !error && (result
            ? <CheckIcon className="h-4 w-4 fill-green-700 dark:fill-green-500" aria-hidden="true" />
            : <XIcon className="h-4 w-4 fill-red-700 dark:fill-red-500" aria-hidden="true" />)}
          {t(status)}
        </span>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label={t('Remove test case')}>
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default TestItem
