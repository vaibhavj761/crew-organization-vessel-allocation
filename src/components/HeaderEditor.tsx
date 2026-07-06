import { useChart } from '../state/ChartContext'
import { TextField } from './FormFields'

export function HeaderEditor() {
  const { data, dispatch } = useChart()
  const update = (field: 'title' | 'organizationName' | 'effectiveDate' | 'footerText', value: string) => dispatch({ type: 'updateMeta', field, value })
  return <div className="form-grid"><TextField label="Chart title" value={data.title} onChange={(v) => update('title', v)} /><TextField label="Organization" value={data.organizationName} onChange={(v) => update('organizationName', v)} /><TextField label="Effective date" type="date" value={data.effectiveDate} onChange={(v) => update('effectiveDate', v)} /><TextField label="Footer text" value={data.footerText} onChange={(v) => update('footerText', v)} /></div>
}
