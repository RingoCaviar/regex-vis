import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai'
import ContentEditor from './features/content'
import Group from './features/group'
import Expression from './features/expression'
import Quantifier from './features/quantifier'
import LookAround from './features/look-around'
import Insert from './features/insert'
import type { NodesInfo } from './utils'
import { genInitialNodesInfo, getInfoFromNodes } from './utils'
import { astAtom, contiguousSelectedNodesAtom, selectedIdsAtom } from '@/atom'

function EditTab() {
  const { t } = useTranslation()
  const nodes = useAtomValue(contiguousSelectedNodesAtom)
  const selectedIds = useAtomValue(selectedIdsAtom)
  const ast = useAtomValue(astAtom)

  const [nodesInfo, setNodesInfo] = useState<NodesInfo>(genInitialNodesInfo())

  const {
    id,
    regex,
    startIndex,
    endIndex,
    group,
    content,
    hasQuantifier,
    quantifier,
    lookAround,
  } = nodesInfo

  useEffect(() => {
    const nodesInfo = getInfoFromNodes(ast, nodes)
    setNodesInfo(nodesInfo)
  }, [ast, nodes])

  if (selectedIds.length > 0 && nodes.length === 0) {
    return (
      <div data-testid="edit-tab" className="text-sm text-muted-foreground">
        {t('Select consecutive nodes in the same sequence to edit them together. You can still delete the selected nodes.')}
      </div>
    )
  }

  return (
    <div data-testid="edit-tab" className="space-y-6">
      <Insert nodes={nodes} />
      <Expression regex={regex} startIndex={startIndex} endIndex={endIndex} />
      {content && (
        <ContentEditor content={content} id={id} quantifier={quantifier} />
      )}
      {group && <Group group={group} />}
      {hasQuantifier && <Quantifier quantifier={quantifier} key={id} />}
      {lookAround && (
        <LookAround kind={lookAround.kind} negate={lookAround.negate} />
      )}
    </div>
  )
}

export default EditTab
