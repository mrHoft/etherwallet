class Route {
  private _pathname: string
  protected _render: () => void

  constructor(pathname: string, render: () => void) {
    this._pathname = pathname
    this._render = render
  }

  public get pathname() {
    return this._pathname
  }

  public navigate() {
    this._render()
  }
}

class Router {
  private history: History = window.history
  private routes: Route[] = []
  private currentRoute: Route | null = null

  public use(pathname: string, page: () => void) {
    const route = new Route(pathname, page)
    this.routes.push(route)
    return this
  }

  public start() {
    window.onpopstate = (event: Event) => {
      event.preventDefault()
      this.onRoute(window.location.pathname)
    }

    this.onRoute(window.location.pathname)
  }

  public navigate(pathname: string) {
    this.history.pushState({ route: pathname }, '', pathname)
    this.onRoute(pathname)
  }

  public back() {
    this.history.back()
  }

  public forward() {
    this.history.forward()
  }

  private getRoute(pathname: string) {
    return this.routes.find(route => route.pathname === pathname) || this.currentRoute
  }

  private onRoute(pathname: string) {
    const route = this.getRoute(pathname) || this.getRoute('/404')
    if (route) {
      this.currentRoute = route
      route.navigate()
    }
  }
}

const router = new Router()
export { router }
