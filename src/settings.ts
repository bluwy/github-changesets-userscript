import { html, signal } from 'uhtml'

const featureDescriptions = {
  'remove-changeset-bot-comment': 'Remove changeset-bot comment',
}

export const featureSettings = Object.fromEntries(
  Object.keys(featureDescriptions).map((key) => [
    key,
    localStorageStore(`github-changesets-userscript:settings:${key}`, true),
  ]),
) as Record<keyof typeof featureDescriptions, LocalStorageStore<boolean>>

interface LocalStorageStore<T> {
  get(): T
  set(value: T): void
  reset(): void
}

function localStorageStore<T>(key: string, defaultValue?: T): LocalStorageStore<T> {
  const store: LocalStorageStore<T> = {
    get() {
      const v = localStorage.getItem(key)
      if (v) return JSON.parse(v)
      if (defaultValue != null) {
        store.reset()
        return JSON.parse(JSON.stringify(defaultValue))
      }
    },
    set(value: T) {
      localStorage.setItem(key, JSON.stringify(value))
    },
    reset() {
      if (defaultValue != null) {
        store.set(defaultValue)
      } else {
        localStorage.removeItem(key)
      }
    },
  }

  return store
}

function Settings() {
  const featureStates = Object.fromEntries(
    Object.entries(featureSettings).map(([name, setting]) => [name, signal(setting.get())]),
  )

  return html`
    <details-menu
      class="js-discussion-sidebar-menu select-menu-modal position-absolute right-0 hx_rsm-modal"
      style="z-index: 99; overflow: visible;"
    >
      <div class="select-menu-header rounded-top-2">
        <span class="select-menu-title">Features</span>
        <span class="color-fg-muted">(Refresh page to view changes)</span>
      </div>
      <div class="select-menu-list">
        ${Object.entries(featureStates).map(([_name, state]) => {
          const name = _name as keyof typeof featureDescriptions
          return html`
            <label
              class="select-menu-item pl-2"
              key=${name}
              style="background-color: var(--overlay-bgColor, var(--color-canvas-overlay))"
            >
              <input
                type="checkbox"
                class="mr-1"
                .checked=${state.value}
                @change=${(e: Event) => {
                  const checked = (e.target as HTMLInputElement).checked
                  featureSettings[name].set(checked)
                  state.value = checked
                }}
              />
              <span>${featureDescriptions[name]}</span>
            </label>
          `
        })}
      </div>
    </details-menu>
  ` as HTMLElement
}

export function getSettingsElement() {
  return html`<${Settings} />` as HTMLElement
}
