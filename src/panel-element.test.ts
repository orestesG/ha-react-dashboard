// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { MiDashboardPanel, definePanel } from './panel-element'
import { HAMenuButton } from './components/ui/HAMenuButton'

describe("HA's menu button", () => {
  it('is requested from the view only while HA reports a narrow layout', () => {
    const seen: boolean[] = []
    class Panel extends MiDashboardPanel {}
    Panel.view = ({ showMenuButton }) => { seen.push(showMenuButton); return null }
    customElements.define('menu-panel', Panel)
    const el = document.createElement('menu-panel') as Panel & { narrow: boolean }

    el.narrow = true // HA sets properties before attaching the element
    document.body.appendChild(el)
    el.narrow = true // unchanged: no re-render
    el.narrow = false
    expect(seen).toEqual([true, false])
    el.remove()
  })

  it("fires HA's toggle event across the shadow root it lives in", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.body.appendChild(document.createElement('div'))
    const container = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('div'))
    const onToggle = vi.fn()
    document.body.addEventListener('hass-toggle-menu', onToggle)
    const root = createRoot(container)
    await act(async () => root.render(createElement(HAMenuButton)))

    container.querySelector('button')!.click()
    expect(onToggle).toHaveBeenCalledOnce()
    await act(async () => root.unmount())
  })
})

describe('panel styles', () => {
  it('swaps in the CSS of whichever panel HA mounts in the shared shadow root', () => {
    (window as Window & { __miDashCss?: Record<string, string> }).__miDashCss = {
      'css-dash': '.react-grid-layout{position:relative}',
      'css-plano': '.h-screen{height:100vh}',
    }
    customElements.define('css-dash', class extends MiDashboardPanel {})
    customElements.define('css-plano', class extends MiDashboardPanel {})
    const host = document.body.appendChild(document.createElement('div'))
    const shadow = host.attachShadow({ mode: 'open' })
    const styles = () => [...shadow.querySelectorAll('style')].map((s) => s.textContent)

    // Like ha-panel-custom: the panel element is replaced, the shadow root (and our <style>) stays
    shadow.appendChild(document.createElement('css-plano'))
    expect(styles()).toEqual(['.h-screen{height:100vh}'])
    shadow.querySelector('css-plano')!.remove()
    shadow.appendChild(document.createElement('css-dash'))
    expect(styles()).toEqual(['.react-grid-layout{position:relative}'])
  })
})

describe('definePanel', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('registers the panel when the tag is free', () => {
    definePanel('def-free', () => null)
    expect(customElements.get('def-free')).toBe(MiDashboardPanel)
  })

  it('reloads once when an older build still holds the tag', () => {
    customElements.define('def-taken', class extends HTMLElement {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    definePanel('def-taken', () => null) // first time: reloads (jsdom ignores it)
    expect(warn).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('mi-dash-reloaded:def-taken')).not.toBeNull()

    definePanel('def-taken', () => null) // right after a reload: no loop, just a warning
    expect(warn).toHaveBeenCalledOnce()
  })
})
