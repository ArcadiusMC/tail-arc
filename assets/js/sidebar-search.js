sidebarSearchMain()

function sidebarSearchMain() {
  const searchInputId = "sidebar-search"
  const sidebarId = "side-navbar"
  let elem = document.getElementById(searchInputId)
  let sidebar = document.getElementById(sidebarId)

  if (elem == null || sidebar == null) {
    return
  }

  elem.oninput = (event) => {
    let params = event.target.value
    filterOutSidebar(sidebar, params)
  }
}

function filterOutSidebar(sidebar, params) {
  const titleAttr = "page-title"
  let splitParams = params.split(/\s+/)
  let children = sidebar.children

  for (let i = 0; i < children.length; i++) {
    let item = children.item(i)

    if (!item.hasAttribute(titleAttr)) {
      continue
    }

    let attr = item.getAttribute(titleAttr)
    let lower = attr.toLowerCase()
    let matched = false
    
    if (params == "") {
      matched = true
    } else {
      for (let pIdx = 0; pIdx < splitParams.length; pIdx++) {
        let param = splitParams[pIdx]
  
        if (lower.indexOf(param) == -1) {
          continue
        }
  
        matched = true
        break
      }
    }

    const hideClass = "hidden"
    let clist = item.classList
    let currentlyHidden = clist.contains(hideClass)

    if (matched) {
      clist.remove(hideClass)
    } else if (!currentlyHidden) {
      clist.add(hideClass)
    }
  }
}