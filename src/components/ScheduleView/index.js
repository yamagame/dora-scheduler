import React, { Component } from 'react';
import * as d3 from 'd3';
import uuidv4 from 'uuid/v4';
import utils from './utils';
import cloneDeep from 'clone-deep';

export const unit = 24;
export const unitScale = (24*60*60*1000/unit);
export const Utils = utils({ unit, unitScale });
export const fontSize = 12;
export const gridScale = 1.4;
export const titleFontSize = 11;

function roundRect(x, y, width, height) {
  const r = height / 2;
  return `M ${x},${y - r} L ${x + width},${y - r} A ${r},${r} 0,0,1 ${x + width},${y + r} L ${x},${y + r} A ${r},${r} 0,0,1 ${x},${y - r} z`;
}

function rect(x1, y1, x2, y2) {
  return `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} z`;
}

function triangle(x1, y1, x2, y2, x3, y3) {
  return `M ${x1},${y1} L ${x3},${y3} L ${x2},${y2} L ${x1},${y1} z`;
}

function gridFitX(self, x) {
  const { unit } = self.props;
  if (x < 0) {
    return parseInt((x-Utils.timeZoneOffset)/unit)*unit-unit+Utils.timeZoneOffset;
  } else {
    return parseInt((x-Utils.timeZoneOffset)/unit)*unit+Utils.timeZoneOffset;
  }
}

function gridFitY(self, x) {
  const { unit } = self.props;
  if (x < 0) {
    return parseInt(x/unit)*unit-unit;
  } else {
    return parseInt(x/unit)*unit;
  }
}

function intersect(rect, x, y) {
  return (rect.x <= x && x < rect.x + rect.width && rect.y <= y && y < rect.y + rect.height);
}

function calcBarTitleXPostion(bar, self, d, width) {
  const bbox = bar.getBBox();
  let dx = 0;
  if (!d.titlePos) d.titlePos = { x:0, y:0 }
  if (self.xScale(d.x+d.width)+bbox.width+32*d.titlePos.x > width && d.titlePos.x >= 0) {
    dx = width-(self.xScale(d.x+d.width)+bbox.width+32*d.titlePos.x);
  }
  if (self.xScale(d.x)-bbox.width+32*d.titlePos.x < 0 && d.titlePos.x <= 0) {
    dx = -(self.xScale(d.x)-bbox.width+32*d.titlePos.x);
  }
  if (d.titlePos.x < 0) {
    return self.xScale(d.x-self.handleDX())-bbox.width+dx/2-2;
  }
  if (d.titlePos.x == 0) {
    return self.xScale(d.x+d.width/2)-bbox.width/2+dx/2;
  }
  return self.xScale(d.x+d.width+self.handleDX())+dx/2+2;
}

function calcBarTitleYPostion(bar, self, d, height) {
  const bbox = bar.getBBox();
  const { unit } = self.props;
  if (!d.titlePos) d.titlePos = { x:0, y:0 }
  if (d.titlePos.y < 0) {
    return self.yScale(Math.floor((d.y+unit/2)/unit)*unit+unit/2+unit/4)-bbox.height;
  }
  if (d.titlePos.y > 0) {
    return self.yScale(Math.floor((d.y+unit/2)/unit)*unit+unit/2+unit/4)+bbox.height;
  }
  return self.yScale(Math.floor((d.y+unit/2)/unit)*unit+unit/2+unit/4);
}

function readOnly(bar) {
  return bar.info && bar.info.readOnly;
}

export default class ScheduleView extends Component {
  constructor(props) {
    super(props)
    this.shiftKey = false;
    this.calendarData = [];
    this.gridData = [];
    this.markyData = {
      x: 100, y: 200, width: 200, height: 100, color: 'rgba(0,0,0,0.1)', type: 'marky',
    }
    const { unit } = props;
    this.cursorData = {
      x: 0 ,
      y: 0,
      width: unit,
      height: unit,
      color: 'rgba(255,0,0,0.05)',
      visible: {
        h: 'hidden',
        v: 'hidden',
      }
    }
    this.selectedBar = [];
    this.state = {
      selectDay: null,
      barData: props.barData,
      calendarData: props.calendarData,
    }
    this.currentColor = [ 0, 255, 0 , 1 ];
    this.currentTitlePos = { x: 1, y: 0 };
    this.focusDelayTimer = null;
    this.undoPtr = 0;
    this.undoBuffer = [];
    this.zoomYPos = null;
    this.zoomXScale = null;
    this.noMoveY = false;
    this.infoData = [];
    this.menuWidth = props.menu.width ? props.menu.width : 100;
    this.menuOpened = props.menu.opened;
  }

  componentWillMount() {
    // this.focused = false;
  }

  componentDidMount() {
    const self = this;
    const { unit } = self.props;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.clientWidth = width;
    this.clientHeight = height;
    const svg = this.svg;

    this.xScale = d3.scaleLinear()
      .domain([0, 0+width*gridScale])
      .range([0, width]);
    this.yScale = d3.scaleLinear()
      .domain([0, 0+height*gridScale])
      .range([0, height]);

    this.dragLeftHandle = d3.drag()
      .on('start', function(d, i) {
        var rect = d3.select(this)
        const bar = self.bar;

        if (!d.selected && !self.shiftKey) {
          bar.selectAll('.selected')
            .each((d) => {
              d.selected = false;
            })
            .classed("selected", false);
        }
        rect.classed("selected", true);
        bar.selectAll('.selected')
            .each((d) => {
              d.ox = self.xScale(d.x);
              d.oy = self.yScale(d.y);
              d.selected = true;
            })

        self.currentColor = d.rgba;
        self.currentTitlePos = d.titlePos;
        self.updateBarSelectState();

        const dragBars = self.selectedBar;
        const selectedBar = cloneDeep(self.selectedBar)

        if (!self.props.readonly && !readOnly(d)) {
          dragBars.forEach((b) => {
            const d = b.d;
            d.ow = d.x+d.width;
            d.ox = self.xScale(d.x);
            d.xx = d.x;
          })
          const dragged = (d) => {
            dragBars.forEach((b) => {
              const d = b.d;
              d.ox += d3.event.dx;
              d.x = self.xScale.invert(d.ox);
              d.width = d.ow-d.x;
              if (d.width < unit) {
                d.x = d.ow-unit;
                d.width = unit;
              }
            })
            self.updateBarSelectState();
          }
          const ended = (d) => {
            const changedBars = [];
            dragBars.forEach((b) => {
              const d = b.d;
              let x = Math.floor((d.x-Utils.timeZoneOffset+unit/2)/unit)*unit+Utils.timeZoneOffset;
              let dx = x-d.x;
              d.x = x;
              d.width -= dx;
              if (d.xx !== d.x) {
                changedBars.push(b);
              }
              delete d.ow;
              delete d.ox;
              delete d.xx;
            })
            if (changedBars.length > 0) {
              self.setUndo(selectedBar.map( v => v.d ), self.selectedBar.map( v => v.d ));
              self.updateBarData(self.selectedBar);
            }
            self.updateBarSelectState();
          }
          d3.event.on("drag", dragged).on("end", ended);
        }
      })

    this.dragRightHandle = d3.drag()
      .on('start', function(d, i) {
        var rect = d3.select(this)
        const bar = self.bar;

        if (!d.selected && !self.shiftKey) {
          bar.selectAll('.selected')
            .each((d) => {
              d.selected = false;
            })
            .classed("selected", false);
        }
        rect.classed("selected", true);
        bar.selectAll('.selected')
            .each((d) => {
              d.ox = self.xScale(d.x);
              d.oy = self.yScale(d.y);
              d.selected = true;
            })

        self.currentColor = d.rgba;
        self.currentTitlePos = d.titlePos;
        self.updateBarSelectState();

        const selectedBar = cloneDeep(self.selectedBar)
        const dragBars = self.selectedBar;

        if (!self.props.readonly && !readOnly(d)) {
          dragBars.forEach((b) => {
            const d = b.d;
            d.ow = d.x;
            d.ox = self.xScale(d.x+d.width);
            d.ww = d.width;
          })
          const dragged = (d) => {
            dragBars.forEach((b) => {
              const d = b.d;
              d.ox += d3.event.dx;
              d.width = self.xScale.invert(d.ox)-d.ow;
              if (d.width < unit) d.width = unit;
            })
            self.updateBarSelectState();
          }
          const ended = (d, i) => {
            const changedBars = [];
            dragBars.forEach((b) => {
              const d = b.d;
              d.width = Math.floor((d.width+unit/2)/unit)*unit;
              if (d.ww !== d.width) {
                changedBars.push(b);
              }
              delete d.ow;
              delete d.ox;
              delete d.ww;
            })
            if (changedBars.length > 0) {
              self.setUndo(selectedBar.map( v => v.d ), self.selectedBar.map( v => v.d ));
              self.updateBarData(self.selectedBar);
            }
            self.updateBarSelectState();
          }
          d3.event.on("drag", dragged).on("end", ended);
        }
      })

    this.dragBar = d3.drag()
      .on('start', function(d, i) {
        var rect = d3.select(this)
        const bar = self.bar;

        if (!d.selected && !self.shiftKey) {
          bar.selectAll('.selected')
            .each((d) => {
              d.selected = false;
            })
            .classed("selected", false);
        }
        rect.classed("selected", true);
        bar.selectAll('.selected')
            .each((d) => {
              d.ox = self.xScale(d.x);
              d.oy = self.yScale(d.y);
              d.selected = true;
            })
        
        self.currentColor = d.rgba;
        self.currentTitlePos = d.titlePos;
        self.updateBarSelectState();

        const selectedBar = cloneDeep(self.selectedBar)

        if (!self.props.readonly) {
          d.xx = d.x;
          d.yy = d.y;
          const dragged = (d) => {
            bar.selectAll('path.body.selected')
              .each((d) => {
                if (!readOnly(d)) {
                  d.ox += d3.event.dx;
                }
                d.oy += d3.event.dy;
                if (!readOnly(d)) {
                  d.x = self.xScale.invert(d.ox);
                }
                d.y = self.yScale.invert(d.oy);
              })
              .attr('d', self.drawRectangle)
            self.updateBarSelectState(false);
          }

          const ended = () => {
            bar.selectAll('path.body.selected')
              .each((d) => {
                if (!readOnly(d)) {
                  d.x = Math.floor((d.x-Utils.timeZoneOffset+unit/2)/unit)*unit+Utils.timeZoneOffset;
                }
                d.y = Math.floor((d.y+unit/2)/unit)*unit;
              })
            const changed = (d.xx !== d.x) || (d.yy !== d.y);
            delete d.ox;
            delete d.oy;
            delete d.xx;
            delete d.yy;
            if (changed) {
              self.setUndo(selectedBar.map( v => v.d ), self.selectedBar.map( v => v.d ));
              self.updateBarData(self.selectedBar);
            }
            self.updateBarSelectState(false);
          }

          d3.event.on("drag", dragged).on("end", ended);
        }
      })

    this.dragMarky = d3.drag()
      .on('start', function(d, i) {
        const marky = self.marky;
        const bar = self.bar;
        let doDrag = false;
        let x = d3.event.x;
        let y = d3.event.y;
        self.markyData.x = x;
        self.markyData.y = y;
        self.markyData.width  = 0;
        self.markyData.height = 0;
        const dragged = (d) => {
          if (!doDrag) {
            x = d3.event.x;
            y = d3.event.y;
            self.markyData.x = x;
            self.markyData.y = y;
            self.markyData.width  = 0;
            self.markyData.height = 0;
            doDrag = true;
          }
          x += d3.event.dx;
          y += d3.event.dy;
          self.markyData.width  = x-self.markyData.x;
          self.markyData.height = y-self.markyData.y;
          marky.selectAll('path')
            .attr('visibility', 'visible')
            .attr('d', self.drawRectangle)
        }
        const ended = () => {
          marky.selectAll('path')
            .attr('visibility', 'hidden')

          let x1 = self.xScale.invert(self.markyData.x);
          let y1 = self.yScale.invert(self.markyData.y);
          let x2 = self.xScale.invert(self.markyData.x+self.markyData.width );
          let y2 = self.yScale.invert(self.markyData.y+self.markyData.height);
          let t;

          t = x1;
          if (x2 < x1) {
            x1 = x2;
            x2 = t;
          }
          t = y1;
          if (y2 < y1) {
            y1 = y2;
            y2 = t;
          }

          bar.selectAll('path.body')
            .classed('selected', (d) => {
              if (self.shiftKey && d.selected) return true;
              d.selected = (x1 <= d.x+d.width && d.x <= x2 && y1 <= d.y+d.height && d.y <= y2);
              return d.selected;
            })

          if (self.selectedBar.length > 0) {
            self.currentColor = self.selectedBar[0].d.rgba;
            self.currentTitlePos = self.selectedBar[0].d.titlePos;
          }
          self.updateBarSelectState();
        }
        d3.event.on("drag", dragged).on("end", ended);
      })

    this.dragMenuHandle = d3.drag()
      .on('start', (d, i) => {
        const dragged = (d) => {
          this.menuWidth += d3.event.dx;
          this.updateMenu();
        }
        const ended = () => {
          if (this.menuWidth <= 0) {
            this.menuWidth = 100;
            this.menuOpened = false;
          }
          this.updateMenu();
          this.onChange({
            menu: {
              width: this.menuWidth,
              opened: this.menuOpened,
            },
          })
        }
        d3.event.on("drag", dragged).on("end", ended);
      })

    let zoomMoved = 0;
    let zoomScale = null;
    let zoomYPos = null;

    this.zoomBehavior = d3.zoom()
      .scaleExtent([0.006, 1])
      .filter(() => {
        return !self.shiftKey;
      })
      .on('start', function() {
        zoomMoved = 0;
        zoomScale = d3.event.transform.k;
        zoomYPos = d3.event.transform.y;
      })
      .on('zoom', () => {
        zoomMoved ++;
        if (zoomScale !== d3.event.transform.k) {
          zoomMoved += 10;
        }
        const transform = d3.event.transform;
        this.xScale.range([transform.applyX(0), transform.applyX(this.clientWidth)]);
        if (zoomScale === transform.k && self.noMoveY != true) {
          this.zoomYPos += d3.event.transform.y - zoomYPos;
          zoomYPos = d3.event.transform.y;
        }
        self.noMoveY = false;
        this.yScale.range([this.zoomYPos, this.zoomYPos+this.clientHeight]);
        this.updateGridRectangles();
        this.updateGrid();
        this.updateCalendarRectangles();
        this.updateCalendar();
        this.updateMenu();
        const bar = this.bar;
        const text = this.text;
        this.zoomXScale = (this.xScale(1)-this.xScale(0))*gridScale;
        bar.selectAll('path.body')
          .attr('d', this.drawRectangle)
        bar.selectAll('path.left')
          .attr('d', this.drawLeftHandle)
        bar.selectAll('path.right')
          .attr('d', this.drawRightHandle)
        text.selectAll('text.title')
          .attr('x', function(d) {
            return calcBarTitleXPostion(this, self, d, self.container.clientWidth);
          })
          .attr('y', function(d) {
            return calcBarTitleYPostion(this, self, d, self.container.clientWidth);
          })
          .attr('font-size', titleFontSize)
        this.redrawCursor();
        this.onChange({
          position: {
            x: -transform.x/transform.k,
            y: this.zoomYPos,
          },
          scale: transform.k,
        })
      })
      .on('end', function() {
        if (zoomMoved < 5) {
          const bar = self.bar;
          const menuRect = self.menuButtonRectangle();
          if (d3.event.sourceEvent /*&& self.focused*/ && self.focusDelayTimer == null) {
            var coords = d3.mouse(this);
            if (!self.props.readonly) {
              if (!intersect(menuRect, coords[0], coords[1]) && (!self.menuOpened || coords[0] > self.menuWidth) && coords[1] > self.yScale(unit*3)-self.yScale(0) && self.selectedBar.length === 0) {
                const cx = gridFitX(self, self.xScale.invert(coords[0]));
                const cy = gridFitY(self, self.yScale.invert(coords[1]));
                if (cx === self.cursorData.x && cy === self.cursorData.y) {
                  const v = (self.cursorData.visible.h || self.cursorData.visible.v)? false　:　true ;
                  self.cursorData.visible.h = v;
                  self.cursorData.visible.v = v;
                } else {
                  self.cursorData.visible.h = true;
                  self.cursorData.visible.v = true;
                }
                self.cursorData.x = cx;
                self.cursorData.y = cy;
                self.redrawCursor();
              }
            }
            bar.selectAll('path').classed('selected', false).each(d => d.selected = false);
            self.updateBarSelectState();
          }
        }
      })

    this.base
      .call(this.zoomBehavior)
      .on('dblclick.zoom', function() {
        var coords = d3.mouse(this);
        if (!self.props.readonly) {
          const menuRect = self.menuButtonRectangle();
          if (!intersect(menuRect, coords[0], coords[1]) && (!self.menuOpened || coords[0] > self.menuWidth) && coords[1] > self.yScale(unit*3)-self.yScale(0) && self.selectedBar.length === 0) {
            const x = gridFitX(self, self.xScale.invert(coords[0]));
            const y = gridFitY(self, self.yScale.invert(coords[1]));
            self.createBar({ x, y, });
          }
        }
      })
      .on('click.zoom', () => {
      })
      .call(this.dragMarky);

    this.zoomBehavior
      .scaleTo(this.base, this.props.scale);
    this.noMoveY = true;
    this.zoomYPos = this.props.position.y;
    this.zoomBehavior
      .translateTo(this.base,
        this.props.position.x+(this.xScale.invert(this.clientWidth/2)-this.xScale.invert(0))/gridScale,0,
      )

    this.updateGridRectangles();
    this.updateGrid();
    this.updateCalendarRectangles();
    this.updateCalendar();
    this.updateBar();
    this.updateMarky();
    this.updateCursor();
    this.updateBarSelectState();
    this.updateMenu();
    document.addEventListener('copy', this.handleCopy);
    document.addEventListener('paste', this.handlePaste);
    document.addEventListener('keydown', this.handleShortcuts)
    document.addEventListener('keyup', this.onKeyUp)
  }

  componentDidUpdate() {
    const width = this.container.clientWidth;
    const self = this;
    this.updateGridRectangles();
    this.updateGrid();
    this.updateCalendarRectangles();
    this.updateCalendar();
    this.redrawCursor();
    const bar = this.bar;
    const text = this.text;
    bar.selectAll('path.body')
      .attr('d', this.drawRectangle)
    bar.selectAll('path.left')
      .attr('d', this.drawLeftHandle)
    bar.selectAll('path.right')
      .attr('d', this.drawRightHandle)
    text.selectAll('text.title')
      .attr('x', function(d) {
        return calcBarTitleXPostion(this, self, d, width);
      })
      .attr('y', function(d) {
        return calcBarTitleYPostion(this, self, d, width);
      })
      .attr('font-size', titleFontSize)
    this.updateMenu();
  }

  componentWillUnmount() {
    document.removeEventListener('copy', this.handleCopy);
    document.removeEventListener('paste', this.handlePaste);
    document.removeEventListener('keydown', this.handleShortcuts)
    document.removeEventListener('keyup', this.onKeyUp)
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.barData !== nextProps.barData) {
      this.setState({
        barData: nextProps.barData,
      }, () => {
        this.updateBar();
      })
    }
    if (this.props.calendarData !== nextProps.calendarData) {
      this.setState({
        calendarData: nextProps.calendarData,
      }, () => {
        this.updateCalendarRectangles();
        this.updateCalendar();
      })
    }
  }

  drawRectangle = (d) => {
    const { unit } = this.props;
    let x = d.x;
    let y = d.y;
    if (typeof d.grid === 'undefined' || d.grid) {
      y = Math.floor((y+unit/2)/unit)*unit;
    }
    if (d.type === 'calendar') {
      const y2 = this.yScale(d.y) - this.yScale(0);
      return rect(
        this.xScale(x), y2,
        this.xScale(x + d.width), y2+this.yScale(unit) - this.yScale(0)
      );
    } else
    if (d.type === 'calendar-circle') {
      const y2 = this.yScale(d.y + unit / 2) - this.yScale(0);
      return roundRect(
        this.xScale(x+unit/2), y2,
        0, this.yScale(unit-2) - this.yScale(0)
      );
    } else
    if (d.type === 'calendar-select') {
      const y2 = this.yScale(d.y) - this.yScale(0);
      return rect(
        this.xScale(x), y2,
        this.xScale(x + d.width), this.container.clientHeight
      );
    } else
    if (d.type === 'marky') {
      return rect(
        x, y,
        x+d.width, y+d.height
      );
    } else
    if (d.type === 'roundrect') {
      return roundRect(
        this.xScale(x+unit/2), this.yScale(y + unit / 2),
        this.xScale(d.width-unit) - this.xScale(0), this.yScale(d.height) - this.yScale(0)
      );
    } else
    if (d.type === 'vertical') {
      return rect(
        this.xScale(x), 0,
        this.xScale(x + d.width), this.container.clientHeight
      );
    } else
    if (d.type === 'horizontal') {
      return rect(
        0, this.yScale(y),
        this.container.clientWidth, this.yScale(y + d.height)
      );
    } else {
      return rect(
        this.xScale(x), this.yScale(y),
        this.xScale(x + d.width), this.yScale(y + d.height)
      );
    }
  }

  handleDX = () => {
    if (this.zoomXScale < 1) {
      return (unit/this.zoomXScale - unit)/2;
    }
    return 0;
  }

  drawLeftHandle = (d) => {
    const unit = this.props.unit;
    return this.drawRectangle({
      x: d.x-this.handleDX(),
      y: d.y,
      width: (unit/4)/(this.zoomXScale < 1 ? this.zoomXScale : 1),
      height: unit,
      type: 'rect',
    })
  }

  drawRightHandle = (d) => {
    const unit = this.props.unit;
    return this.drawRectangle({
      x: d.x+d.width-unit/4+this.handleDX(),
      y: d.y,
      width: (unit/4)/(this.zoomXScale < 1 ? this.zoomXScale : 1),
      height: unit,
      type: 'rect',
    })
  }

  updateBarData = (bars) => {
    const barData = [ ...this.state.barData ];
    const updateBars = [];
    bars.forEach( v => {
      if (v.i == null) {
        barData.push(v.d);
        updateBars.push(v.d)
      } else {
        Object.keys(v.d).forEach( k => {
          barData[v.i][k] = v.d[k];
        })
        updateBars.push(barData[v.i])
      }
    })
    this.setState({
      barData,
    }, () => {
      this.onChange({
        bars: updateBars,
      })
    })
  }

  updateGridRectangles = () => {
    const { unit } = this.props;
    const ox = Math.floor(this.xScale.invert(0) / (unit * 2)) * (unit * 2);
    const oy = Math.floor(this.yScale.invert(0) / (unit * 2)) * (unit * 2);
    const dx = Math.floor((this.xScale.invert(this.container.clientWidth)-Utils.timeZoneOffset) / (unit * 2)) * (unit * 2);
    const dy = Math.floor(this.yScale.invert(this.container.clientHeight) / (unit * 2)) * (unit * 2);
    this.gridData = []
    for (var y = oy; y < dy + (unit * 2); y += (unit * 2)) {
      this.gridData.push({
        x: 0+Utils.timeZoneOffset, y: y, width: unit, height: unit, color: 'rgba(220,255,255,0.5)', type: 'horizontal',
      })
    }
    const _fontScaleX = (v) => {
      const q = (this.xScale(v)-this.xScale(0))*gridScale;
      return q;
    }
    const dayAlpha = () => {
      const s = _fontScaleX(1);
      if (s <= 0.8) {
        if (s < 0.2) return 0;
        return (s-0.2)/0.6;
      }
      return 1;
    }
    if (dayAlpha() > 0) {
      const a = dayAlpha();
      for (var x = ox; x < dx + (unit * 2); x += (unit * 2)) {
        this.gridData.push({
          x: x+Utils.timeZoneOffset, y: 0, width: unit, height: unit, color: `rgba(220,220,235,${0.2*a})`, type: 'vertical',
        })
      }
    }
    const monthAlpha = () => {
      const s = _fontScaleX(1);
      if (s <= 0.6) {
        if (s < 0.02) return 0;
        if (s >= 0.1) {
          return (0.5-(s-0.1))/0.5;
        }
        if (s <= 0.05) {
          return (s-0.02)/0.03;
        }
        return 1;
      }
      return 0;
    }
    if (monthAlpha() > 0) {
      const a = monthAlpha();
      const sx = new Date(ox*unitScale);
      const ex = new Date((dx + (unit * 2))*unitScale);
      let x = (new Date(`${sx.getFullYear()}/${sx.getMonth()+1}`));
      let nextx = null;
      while (x.getTime()/unitScale < dx + (unit * 2)) {
        if (x.getMonth() >= 11) {
          nextx = new Date(`${x.getFullYear()+1}/1`);
        } else {
          nextx = new Date(`${x.getFullYear()}/${x.getMonth()+2}`);
        }
        if ((x.getMonth() % 2) === 0) {
          this.gridData.push({
            x: x.getTime()/unitScale+Utils.timeZoneOffset, y: 0, width: (nextx.getTime()-x.getTime())/unitScale, height: unit, color: `rgba(220,220,235,${0.2*a})`, type: 'vertical',
          })
        }
        x = nextx;
      }
    }
    const yearAlpha = () => {
      const s = _fontScaleX(1);
      if (s <= 0.06) {
        if (s < 0.03) {
          return 1;
        }
        return (0.03-(s-0.03))/0.03;
      }
      return 0;
    }
    if (yearAlpha() > 0) {
      const a = yearAlpha();
      const sx = new Date(ox*unitScale);
      const ex = new Date((dx + (unit * 2))*unitScale);
      let x = (new Date(`${sx.getFullYear()+1}/1`));
      let nextx = null;
      while (x.getTime()/unitScale < dx + (unit * 2)) {
        nextx = new Date(`${x.getFullYear()+1}/1`);
        if ((x.getFullYear() % 2) === 0) {
          this.gridData.push({
            x: x.getTime()/unitScale+Utils.timeZoneOffset, y: 0, width: (nextx.getTime()-x.getTime())/unitScale, height: unit, color: `rgba(220,220,235,${0.2*a})`, type: 'vertical',
          })
        }
        x = nextx;
      }
    }
  }

  updateCalendarRectangles = () => {
    const { unit, unitScale } = this.props;
    this.calendarData = [];
    const r1 = this.xScale.invert(0);
    const x1 = Math.floor(this.xScale.invert(0)/unit)*unit;
    const x2 = this.xScale.invert(this.container.clientWidth)-Utils.timeZoneOffset;
    const years = {};
    const month = {};
    const unitTime = unit*unitScale;
    const dayCell = [];

    const _fontScaleX = (v) => {
      const q = (this.xScale(v)-this.xScale(0))*gridScale;
      return q;
    }
    const a = _fontScaleX(1);

    this.calendarData.push({
      x: x1+Utils.timeZoneOffset,
      y: unit,
      width: x2-x1,
      height: 0,
      color: "rgba(235,235,235,255)",
      type: 'calendar',
      dateType: 'bg',
      text: null,
      time: null,
    })

    this.calendarData.push({
      x: x1+Utils.timeZoneOffset,
      y: unit*2,
      width: x2-x1,
      height: 0,
      color: 'white',
      type: 'calendar',
      dateType: 'bg',
      text: null,
      time: null,
    })

    //日
    for (var x=x1;x<=x2;x+=unit) {
      const date = new Date(x*unitScale);
      let day = date.getDay();
      let startTime = date.getTime();
      let endTime = date.getTime()+unitTime;
      if (!years[date.getFullYear()]) {
        years[date.getFullYear()] = { start: startTime, end: endTime };
      } else {
        years[date.getFullYear()].end = endTime;
      }
      const monthKey = `${date.getFullYear()}/${date.getMonth()+1}`;
      if (!month[monthKey]) {
        month[monthKey] = { start: startTime, end: endTime  };
      } else {
        month[monthKey].end = endTime;
      }
      month[monthKey].month = date.getMonth()+1;
      let color = "#00000000";
      if (day === 0) {
        color = "#FFDCDCFF";
      } else
      if (day === 6) {
        color = "#DCDCFFFF";
      }
      if (this.state.calendarData[Utils.dateStr(date)]) {
        const d = this.state.calendarData[Utils.dateStr(date)];
        if ('color' in d) {
          color = d.color;
        }
      }
      if (a > 0.1) {
        dayCell.push({
          x: x+Utils.timeZoneOffset,
          y: unit*2,
          width: unit,
          height: unit,
          color,
          type: 'calendar',
          dateType: 'day',
          text: date.getDate(),
          time: date,
        });
      }
    }

    //年
    Object.keys(years).map(v => parseInt(v)).sort().forEach( (k, i) => {
      const v = years[k];
      const d = parseInt(k) % 2;
      const color = d === 0 ? "rgba(250,250,250,255)" : "rgba(240,240,255,255)";
      this.calendarData.push({
        x: Math.max(v.start/unitScale+Utils.timeZoneOffset, r1),
        y: 0,
        width: (Math.min(v.end/unitScale, x2)-Math.max(v.start/unitScale, r1)),
        height: unit,
        color,
        type: 'calendar',
        dateType: 'year',
        text: k,
      })
    })

    //月
    Object.keys(month).sort().forEach( (k, i) => {
      const v = month[k];
      if (v) {
        const date = new Date(v.start);
        let color;
        if ((date.getMonth() % 2) === 0) {
          color = "rgba(235,235,235,255)";
        } else {
          color = "rgba(225,225,225,255)";
        }
        this.calendarData.push({
          x: Math.max(v.start/unitScale+Utils.timeZoneOffset, r1),
          y: unit,
          width: (Math.min(v.end/unitScale, x2)-Math.max(v.start/unitScale, r1)),
          height: unit,
          color,
          type: 'calendar',
          dateType: 'month',
          text: v.month,
        })
      }
    })

    dayCell.forEach( v => {
      this.calendarData.push(v);
    });
  }

  gridRectangles = () => {
    return this.gridData;
  }

  calendarRectangles = () => {
    return this.calendarData;
  }

  barRectangles = () => {
    return this.state.barData;
  }

  markyRectangles = () => {
    return this.markyData;
  }

  todayRectangles = () => {
    const { unit, unitScale } = this.props;
    const today = new Date();
    const x = parseInt(parseInt(today.getTime()/unitScale-Utils.timeZoneOffset)/unit)*unit;
    return [
      { x: x+Utils.timeZoneOffset, y: unit*2, height: unit, width: unit, color: 'rgba(0,255,0,0.6)', type: 'calendar-circle', }
    ]
  }

  calendarSelectRectangles = () => {
    const { unit, unitScale } = this.props;
    if (this.state.selectDay) {
      const x = this.state.selectDay.getTime()/unitScale+Utils.timeZoneOffset;
      return [
        { x, y: unit*2, height: unit, width: unit, color: 'rgba(128,255,0,0.2)', type: 'calendar-select', }
      ]
    }
    return [];
  }

  updateGrid = () => {
    const width = this.container.clientWidth;

    const grid = this.grid;
    grid
      .selectAll('path')
      .remove();
    grid
      .selectAll('path')
      .data(this.gridRectangles())
      .enter()
      .append('path')
      .attr('class', 'line')
      .style("pointer-events", "none")
      .attr('stroke', 'none')
      .attr('stroke-width', 2)
      .attr('fill', (d) => d.color ? d.color : 'none')
      .attr('d', this.drawRectangle)

    grid
      .selectAll('line')
      .remove();

    const menuData = {}
    this.state.barData.forEach( v => {
      if (!menuData[v.y] || (menuData[v.y] && menuData[v.y].x > v.x)) {
        if (v.headingFlag && v.title && v.title.trim() !== '') {
          menuData[v.y] = v;
        }
      }
    })
    this.menuData = Object.keys(menuData).map( k => {
      return menuData[k];
    });

    grid
      .selectAll('line')
      .data(this.menuData)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('y1', d => this.yScale(Math.floor((d.y+unit/2)/unit)*unit))
      .attr('x2', width)
      .attr('y2', d => this.yScale(Math.floor((d.y+unit/2)/unit)*unit))
      .style("stroke", "lightgray")
      .style("stroke-width", 1)
  }

  updateCalendar = () => {
    const { unit, } = this.props;
    const calendar = this.calendar;

    const _fontScaleX = (v) => {
      const q = (this.xScale(v)-this.xScale(0))*gridScale;
      return q;
    }

    const fontScaleX = (d) => {
      return d.dateType === 'day' ? (_fontScaleX(1) >= 1 ? 1 : _fontScaleX(1)) : 1;
    }
    const faceFont = (d) => {
      const s = _fontScaleX(d);
      if (s <= 0.8) {
        if (s < 0.2) return 0;
        return ((s-0.2)/0.6)*0.8;
      }
      return 0.8;
    }

    calendar
      .selectAll('path')
      .remove();
    calendar
      .selectAll('text')
      .remove();
    calendar
      .selectAll('path.date')
      .data(this.calendarRectangles().filter( d => {
        if (d.color != null) {
          switch (d.dateType) {
          case 'day':
            return faceFont(1) > 0;
          case 'month':
            return faceFont(10) > 0;
          default:
            break;
          }
          return true;
        }
        return false;
      }))
      .enter()
      .append('path')
      .attr('class', 'date')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('fill', (d) => {
        if (d.selected) {
          return ('color' in d) ? d.color : `rgba(${parseInt(d.rgba[0]*0.8)},${parseInt(d.rgba[1]*0.8)},${parseInt(d.rgba[2]*0.8)},${d.rgba[3]})`;
        }
        return ('color' in d) ? d.color : `rgba(${parseInt(d.rgba[0])},${parseInt(d.rgba[1])},${parseInt(d.rgba[2])},${d.rgba[3]})`;
      })
      .attr('d', this.drawRectangle)
      .on('dblclick', (d) => {
        if (d.time) {
          const t = Utils.dateStr(d.time);
          const calendarData = { ...this.state.calendarData }
          const v = calendarData[t];
          if (v) {
            delete calendarData[t];
          } else {
            calendarData[t] = { color: '#FFDCDCFF' }
          }
          this.setState({
            calendarData,
          })
          if (this.props.onEditCalendar) {
            this.props.onEditCalendar(calendarData);
          }
        }
      })
      .on('click', (d) => {
        if (d.time) {
          const x = d.time.getTime()/unitScale+Utils.timeZoneOffset;
          if (this.cursorData.visible.v && x == this.cursorData.x) {
            this.cursorData.visible.v = false;
          } else {
            this.cursorData.x = x;
            this.cursorData.visible.v = true;
          }
          this.redrawCursor();
        }
      })

    calendar
      .selectAll('path.today')
      .data(this.todayRectangles())
      .enter()
      .append('path')
      .attr('class', 'today')
      .attr('stroke', 'none')
      .style("pointer-events", "none")
      .attr('fill', 'gree')
      .attr('d', this.drawRectangle);

    calendar
      .selectAll('path.select')
      .data(this.calendarSelectRectangles())
      .enter()
      .append('path')
      .attr('class', 'today')
      .attr('stroke', 'none')
      .attr('stroke-width', 2)
      .style("pointer-events", "none")
      .attr('d', this.drawRectangle);

    calendar
      .selectAll('text')
      .data(this.calendarRectangles().filter( d => {
        switch (d.dateType) {
        case 'day':
          return faceFont(1) > 0;
        case 'month':
          return faceFont(10) > 0;
        default:
          break;
        }
        return true;
      }))
      .enter()
      .append('text')
      .attr('x', d => this.xScale(d.x+d.width/2)/fontScaleX(d))
      .attr('y', d => this.yScale(d.y+unit*3/4)-this.yScale(0))
      .text(d => d.text)
      .attr('text-anchor', 'middle')
      .attr('vertical-align', 'middle')
      .attr('font-size', fontSize)
      .attr('transform', d => `scale(${fontScaleX(d)},1)`)
      .attr('fill', 'black')
      .attr('fill-opacity' , d => {
        switch (d.dateType) {
        case 'day':
          return faceFont(1);
        case 'month':
          return faceFont(10);
        default:
          break;
        }
        return 0.8;
      })
      .attr('visibility', 'visible')
      .style('pointer-events', 'none')
      .style('font-weight', 'bold')

    calendar
      .selectAll('path')
      .attr('d', this.drawRectangle)
      .attr('fill', (d) => {
        if (d.selected) {
          return ('color' in d) ? d.color : `rgba(${parseInt(d.rgba[0]*0.8)},${parseInt(d.rgba[1]*0.8)},${parseInt(d.rgba[2]*0.8)},${d.rgba[3]})`;
        }
        return ('color' in d) ? d.color : `rgba(${parseInt(d.rgba[0])},${parseInt(d.rgba[1])},${parseInt(d.rgba[2])},${d.rgba[3]})`;
      })
  }

  onEdit = (d, i) => {
    if (this.props.onEdit) {
      this.props.onEdit({ d, i });
    }
  }

  onCreate = (d) => {
    if (this.props.onCreate) {
      this.props.onCreate(d);
    }
  }

  onChange = (event) => {
    if (this.props.onChange) {
      this.props.onChange(event);
    }
  }

  onKeyDown_ = (event) => {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(event);
    }
  }

  updateScreen = (barData) => {
    this.setState({
      barData,
    }, () => {
      this.onChange({
        bars: barData,
      })
      this.updateBar();
    })
  }

  updateBar = () => {
    const self = this;
    const bar = this.bar;
    const text = this.text;
    self.selectedBar = [];

    bar.selectAll('g')
      .remove();

    text.selectAll('g')
      .remove();

    // const path = bar
    //   .selectAll('g.bar')
    //   .data(this.barRectangles())
 
    const g = bar
      .selectAll('g.bar')
      .data(this.barRectangles())
      .enter()
      .append('g')
      .classed('bar', true)
      .attr('x', 0)
      .attr('y', 0);
 
    const g2 = text
      .selectAll('g.text')
      .data(this.barRectangles())
      .enter()
      .append('g')
      .classed('bar', true)
      .attr('x', 0)
      .attr('y', 0);

    // bar
    //   .selectAll('g.bar')
    //   .data(this.barRectangles())
    //   .exit()
    //   .remove();

    // path.exit()
    //   .remove();

    function pushBarInfo(d, event) {
      const x1 = Utils.dateStr(new Date(d.x*unitScale));
      const x2 = Utils.dateStr(new Date((d.x+d.width-unit)*unitScale))
      self.infoData.push({
        x: self.xScale.invert(event.clientX),
        y: d.y-unit,
        text: `${d.title} : ${x1 !== x2 ? `${x1}-${x2}` : `${x1}`}`,
      })
    }

    g.append('g')
      .append('path')
      .classed('body', true)
      .classed('selected', d => d.selected)
      .each((d,i) => {
        if (d.selected) {
          self.selectedBar.push({ d, i });
        }
      })
      .attr('stroke-width', 2)
      .attr('fill', (d) => {
        try {
          if (d.selected) {
            return ('color' in d) ? d.color : `rgba(${parseInt(d.rgba[0]*0.8)},${parseInt(d.rgba[1]*0.8)},${parseInt(d.rgba[2]*0.8)},${d.rgba[3]})`;
          }
          return ('color' in d) ? d.color : `rgba(${parseInt(d.rgba[0])},${parseInt(d.rgba[1])},${parseInt(d.rgba[2])},${d.rgba[3]})`;
        } catch(err) {
          return '#00FF00';
        }
      })
      .attr('d', this.drawRectangle)
      .style('cursor', 'move')
      .call(this.dragBar)
      .on('dblclick',function(d, i){
        self.onEdit(d, i);
      })
      .on('mouseover', (d, i) => {
        if (this.shiftKey) {
          pushBarInfo(d, d3.event);
          this.updateInfo();
        }
      })
      .on('mouseout', (d, i) => {
        this.infoData = [];
        this.updateInfo();
      })

    this.zoomXScale = (this.xScale(1)-this.xScale(0))*gridScale;

    g.append('g')
      .append('path')
      .classed('left', true)
      .attr('stroke-width', 2)
      .attr('fill', 'rgba(0,0,0,0)')
      .attr('d', this.drawLeftHandle)
      .style('cursor', 'w-resize')
      .call(this.dragLeftHandle)
      .on('dblclick',function(d, i){
        self.onEdit(d, i);
      })
      .on('mouseover', (d, i) => {
        if (this.shiftKey) {
          pushBarInfo(d, d3.event);
          this.updateInfo();
        }
      })
      .on('mouseout', (d, i) => {
        this.infoData = [];
        this.updateInfo();
      })

    g.append('g')
      .append('path')
      .classed('right', true)
      .attr('stroke-width', 2)
      .attr('fill', 'rgba(0,0,0,0)')
      .attr('d', this.drawRightHandle)
      .style('cursor', 'e-resize')
      .call(this.dragRightHandle)
      .on('dblclick',function(d, i){
        self.onEdit(d, i);
      })
      .on('mouseover', (d, i) => {
        if (this.shiftKey) {
          pushBarInfo(d, d3.event);
          this.updateInfo();
        }
      })
      .on('mouseout', (d, i) => {
        this.infoData = [];
        this.updateInfo();
      })

    g2.append('g')
      .append('text')
      .classed('title', true)
      .attr('font-size', titleFontSize)
      .attr('fill', 'blue')
      .style('pointer-events', 'none')
      .style('zIndex', 10)
      .style('font-weight', 'bold')
      .text(d => d.title)
      .attr("text-anchor", "start")
      .attr("alignment-baseline", "auto")
      .attr('x', function(d) {
        return calcBarTitleXPostion(this, self, d, self.container.clientWidth);
      })
      .attr('y', function(d) {
        return calcBarTitleYPostion(this, self, d, self.container.clientWidth);
      })

    //g.exit().remove()

    this.redrawCursor();
  }

  updateBarSelectState = (redraw=true) => {
    const self = this;
    const bar = this.bar;
    const text = this.text;
    self.selectedBar = [];

    this.zoomXScale = (this.xScale(1)-this.xScale(0))*gridScale;

    bar
      .selectAll('path.body')
      .each((d,i) => {
        if (d.selected) {
          self.selectedBar.push({ d, i });
        }
      })
      .attr('fill', (d) => {
        try {
          if (d.selected) {
            return ('color' in d) ? d.color : `rgba(${parseInt(d.rgba[0]*0.8)},${parseInt(d.rgba[1]*0.8)},${parseInt(d.rgba[2]*0.8)},${d.rgba[3]})`;
          }
          return ('color' in d) ? d.color : `rgba(${parseInt(d.rgba[0])},${parseInt(d.rgba[1])},${parseInt(d.rgba[2])},${d.rgba[3]})`;
        } catch(err) {
          return '#00FF00';
        }
      })
      .attr('d', this.drawRectangle)
    bar
      .selectAll('path.left')
      .attr('d', this.drawLeftHandle)
    bar
      .selectAll('path.right')
      .attr('d', this.drawRightHandle)

    text
      .selectAll('text.title')
      .attr('x', function(d) {
        return calcBarTitleXPostion(this, self, d, self.container.clientWidth);
      })
      .attr('y', function(d) {
        return calcBarTitleYPostion(this, self, d, self.container.clientWidth);
      })
      .text(d => d.title)
    if (this.props.onSelect && redraw) this.props.onSelect();
  }

  updateMarky = () => {
    const marky = this.marky;
    marky
      .selectAll('path')
      .data([this.markyRectangles()])
      .enter()
      .append('path')
      .attr('class', 'marky')
      //.style("pointer-events", "none")
      .attr('visibility', 'hidden')
      .attr('stroke', 'none')
      .attr('stroke-width', 2)
      .attr('fill', (d) => d.color ? d.color : 'none')
      .attr('d', this.drawRectangle)
  }

  barDateText = (d) => {
    const x1 = Utils.dateStr(new Date(d.x*unitScale));
    const x2 = Utils.dateStr(new Date((d.x+d.width-unit)*unitScale))
    return x1 !== x2 ? `${x1}-${x2}` : `${x1}`;
  }

  cursorRectangles = () => {
    return this.cursorData;
  }

  cursorVRectangles = () => {
    return {
      x: this.cursorData.x,
      y: 0,
      height: unit,
      width: unit,
      type: 'vertical',
      color: this.cursorData.color,
      visible: this.cursorData.visible.v,
    };
  }
  
  cursorHRectangles = () => {
    return {
      x: 0,
      y: this.cursorData.y,
      height: unit,
      width: unit,
      type: 'horizontal',
      color: this.cursorData.color,
      visible: this.cursorData.visible.h,
    };
  }

  updateCursor = () => {
    const cursor = this.cursor;
    cursor
      .selectAll('path.cursor')
      .data([this.cursorData])
      .enter()
      .append('path')
      .attr('class', 'cursor')
      //.style("pointer-events", "none")
      .attr('visibility', d => (this.cursorData.visible.v && this.cursorData.visible.h) ? 'visible' : 'hidden' )
      .attr('stroke', 'none')
      .attr('stroke-width', 2)
      .attr('fill', (d) => d.color ? d.color : 'none')
      .attr('d', this.drawRectangle)
    cursor
      .selectAll('path.v-cursor')
      .data([this.cursorVRectangles()])
      .enter()
      .append('path')
      .attr('class', 'v-cursor')
      //.style("pointer-events", "none")
      .attr('visibility', d => d.visible ? 'visible' : 'hidden' )
      .attr('stroke', 'none')
      .attr('stroke-width', 2)
      .attr('fill', (d) => d.color ? d.color : 'none')
      .attr('d', this.drawRectangle)
    cursor
      .selectAll('path.h-cursor')
      .data([this.cursorHRectangles()])
      .enter()
      .append('path')
      .attr('class', 'h-cursor')
      //.style("pointer-events", "none")
      .attr('visibility', d => d.visible ? 'visible' : 'hidden' )
      .attr('stroke', 'none')
      .attr('stroke-width', 2)
      .attr('fill', (d) => d.color ? d.color : 'none')
      .attr('d', this.drawRectangle)
  }

  redrawCursor = () => {
    const cursor = this.cursor;
    cursor.selectAll('path.cursor')
      .data([this.cursorData])
      .attr('visibility', d => (this.cursorData.visible.v && this.cursorData.visible.h) ? 'visible' : 'hidden')
      .attr('d', this.drawRectangle)
    cursor.selectAll('path.v-cursor')
      .data([this.cursorVRectangles()])
      .attr('visibility', d => d.visible ? 'visible' : 'hidden')
      .attr('d', this.drawRectangle)
    cursor.selectAll('path.h-cursor')
      .data([this.cursorHRectangles()])
      .attr('visibility', d => d.visible ? 'visible' : 'hidden')
      .attr('d', this.drawRectangle)
  }

  updateInfo = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.info.selectAll('text')
      .remove()
    this.infoBG.selectAll('text')
      .remove()
    this.infoBG.selectAll('rect')
      .remove()

    this.infoData.forEach( d => {
      const text = this.text.append('text')
        .attr('visibility', 'hidden')
        .style("pointer-events", "none")
        .attr('fill', 'black')
        .attr('font-size', titleFontSize)
        .attr('x', this.xScale(d.x)+8)
        .attr('y', this.yScale(d.y)+8)
        .text( `${d.text}` )
      
      const bbox = text.node().getBBox();

      if (bbox.x+bbox.width > width) {
        bbox.x = width-bbox.width-3;
      }

      this.infoBG.append('rect')
        .style("pointer-events", "none")
        .attr('x', bbox.x-2)
        .attr('y', bbox.y-2)
        .attr('width', bbox.width+4)
        .attr('height', bbox.height+4)
        .style("fill", "white")
        .style("stroke", "#666")
        .style("stroke-width", "1.5px");

      this.infoBG.append('text')
        .style("pointer-events", "none")
        .attr('fill', 'black')
        .attr('font-size', titleFontSize)
        .attr('x', bbox.x)
        .attr('y', bbox.y+11)
        .text( `${d.text}` )

    });
  }

  menuButtonRectangle = () => {
    const x = this.menuOpened ? this.menuWidth-16 : 0 ;
    const y = (this.yScale(unit) - this.yScale(0))*3+1;
    const w = 16;
    return { x, y, width: w, height: w }
  }

  updateMenu = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.menuGrid = [];

    const { unit } = this.props;
    const ox = Math.floor(this.xScale.invert(0) / (unit * 2)) * (unit * 2);
    const oy = Math.floor(this.yScale.invert(0) / (unit * 2)) * (unit * 2);
    const dx = Math.floor((this.xScale.invert(this.container.clientWidth)-Utils.timeZoneOffset) / (unit * 2)) * (unit * 2);
    const dy = Math.floor(this.yScale.invert(this.container.clientHeight) / (unit * 2)) * (unit * 2);
    let d = 0;
    for (var y = oy; y < dy + unit*2; y += unit) {
      if (d % 2 == 0) {
        this.menuGrid.push({
          x: 0, y: y, width: unit, height: unit, color: 'rgba(255,255,255,0.9)', type: 'horizontal',
        })
      } else {
        this.menuGrid.push({
          x: 0, y: y, width: unit, height: unit, color: 'rgba(250,250,255,0.9)', type: 'horizontal',
        })
      }
      d ++;
    }

    this.menu
      .selectAll('rect')
      .remove();

    this.menu
      .selectAll('line')
      .remove();

    //draw menu bg
    if (this.menuOpened && this.menuWidth > 0) {
      this.menu
        .selectAll('rect')
        .data(this.menuGrid)
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', d => this.yScale(d.y))
        .attr('width', this.menuOpened ? this.menuWidth : 0)
        .attr('height', this.yScale(unit) - this.yScale(0))
        .style("fill", d => d.color)
        .style("stroke", "none")
        .on('dblclick', (d) => {
        })
        .on('click', (d) => {
          if (this.cursorData.visible.h && this.cursorData.y == d.y) {
            this.cursorData.visible.h = false;
          } else {
            this.cursorData.y = d.y;
            this.cursorData.visible.h = true;
          }
          this.redrawCursor();
        })

      this.menu
        .append('line')
        .attr('x1', this.menuOpened ? this.menuWidth : 0)
        .attr('y1', 0)
        .attr('x2', this.menuOpened ? this.menuWidth : 0)
        .attr('y2', height)
        .style("stroke", "lightgray")
        .style("stroke-width", 1)

      this.menu
        .append('rect')
        .attr('x', (this.menuOpened ? this.menuWidth : 0)-2)
        .attr('y', 0)
        .attr('width', 4)
        .attr('height', height)
        .attr('fill', 'rgba(0,0,0,0)')
        .style('cursor', 'ew-resize')
        .call(this.dragMenuHandle);
    }

    this.menuMask
      .selectAll('rect')
      .remove();
    this.menuInfo
      .selectAll('text')
      .remove();
    this.menuInfo
      .selectAll('line')
      .remove();

    //draw menu text
    if (this.menuOpened && this.menuWidth > 0) {

      const menuData = {}
      this.state.barData.forEach( v => {
        if (!menuData[v.y] || (menuData[v.y] && menuData[v.y].x > v.x)) {
          if (v.headingFlag && v.title && v.title.trim() !== '') {
            menuData[v.y] = v;
          }
        }
      })
      this.menuData = Object.keys(menuData).map( k => {
        return menuData[k];
      });

      this.menuMask
        .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', this.menuOpened ? this.menuWidth : 0)
        .attr('height', height)
        .attr('fill', 'white')

      this.menuInfo
        .selectAll('text')
        .data(this.menuData)
        .enter()
        .append('text')
        .style("pointer-events", "none")
        .attr('fill', 'black')
        .attr('font-size', fontSize)
        .attr('font-weight', 'bold')
        .attr('x', 8)
        .attr('y', d => this.yScale(Math.floor((d.y+unit/2)/unit)*unit+unit/2+unit/4))
        .text(  d => d.title )

      this.menuInfo
        .selectAll('line')
        .data(this.menuData)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('y1', d => this.yScale(Math.floor((d.y+unit/2)/unit)*unit))
        .attr('x2', this.menuWidth)
        .attr('y2', d => this.yScale(Math.floor((d.y+unit/2)/unit)*unit))
        .style("stroke", "lightgray")
        .style("stroke-width", 1)
    }

    //draw open close button
    {
      this.menu
        .selectAll('g')
        .remove();

      const openButton = this.menu
        .append('g')
      
      const menuRect = this.menuButtonRectangle();
      const x = menuRect.x;
      const y = menuRect.y;
      const w = menuRect.width;
      const h = menuRect.height;
      
      openButton
        .append('rect')
        .attr('x', x)
        .attr('y', y)
        .attr('width', w)
        .attr('height', h)
        .style("fill", 'white')
        .style("stroke", "lightgray")
        .style("stroke-width", 1)
        .on('click', (d) => {
          if (this.menuWidth === 0 || this.menuOpened == false) {
            if (this.menuWidth === 0) {
              this.menuWidth = 100;
            }
            this.menuOpened = true;
          } else {
            this.menuOpened = false;
          }
          this.onChange({
            menu: {
              width: this.menuWidth,
              opened: this.menuOpened,
            },
          })
          this.updateMenu();
        })

      openButton
        .append('path')
        .attr('class', 'line')
        .style("pointer-events", "none")
        .attr('stroke', 'none')
        .attr('stroke-width', 2)
        .attr('fill', 'lightgray')
        .attr('d', () => {
          if (this.menuOpened) {
            return triangle( x+1, y+(h-2)/2, x+w-2, y+h-1, x+w-2, y+1 )
          } else {
            return triangle( x+w-2, y+(h-2)/2, x+1, y+h-1, x+1, y+1 )
          }
        })
    }

  }

  createBar = (pos) => {
    if (!this.props.readonly) {
      const bar = {
        uuid: uuidv4(),
        x: pos.x,
        y: pos.y,
        width: unit,
        height: unit,
        title: '',
        text: '',
        type: 'roundrect',
        grid: true,
        rgba: this.currentColor,
        selected: true,
        titlePos: { ...this.currentTitlePos },
      }
      this.setUndo([null], [bar], 'new');
      this.onCreate(bar)
      return true;
    }
    return false;
  }

  deleteBar = () => {
    if (!this.props.readonly) {
      this.onKeyDown_({ keyCode: 8, });
    }
  }

  handleShortcuts = (e) => {
    this.shiftKey = e.shiftKey;
    if (this.props.focused) 
    {

      const moveTo = (x, y) => {
        if (!this.props.readonly) {
          const selectedBar = cloneDeep(this.selectedBar)
          if (this.selectedBar.length > 0) {
            this.selectedBar.forEach( v => {
              if (!readOnly(v.d)) {
                v.d.x += x;
              }
              v.d.y += y;
            })
            this.setUndo(selectedBar.map( v => v.d ), this.selectedBar.map( v => v.d ));
            this.updateBarData(this.selectedBar);
            this.updateBarSelectState();
          } else {
            this.cursorData.x += x;
            this.cursorData.y += y;
            this.updateCursor();
            this.redrawCursor();
          }
        }
      }

      const textPosition = (x, y) => {
        if (!this.props.readonly) {
          const selectedBar = cloneDeep(this.selectedBar)
          this.selectedBar.forEach( v => {
            if (!readOnly(v.d)) {
              if (!v.d.titlePos || typeof(v.d.titlePos) !== 'object') v.d.titlePos = { x:0, y: 0 };
              function limit(v) {
                if (v < -1) v = -1;
                if (v >  1) v =  1;
                return v;
              }
              v.d.titlePos.x += x;
              v.d.titlePos.x = limit(v.d.titlePos.x);
              v.d.titlePos.y += y;
              v.d.titlePos.y = limit(v.d.titlePos.y);
            }
          })
          this.setUndo(selectedBar.map( v => v.d ), this.selectedBar.map( v => v.d ));
          this.updateBarData(this.selectedBar);
          this.updateBarSelectState();
        }
      }

      //command+z
      if((e.ctrlKey || e.metaKey) && e.keyCode === 90) {
        e.preventDefault();
        if (!this.props.readonly) {
          if (e.shiftKey) {
            this.doRedo();
          } else {
            this.doUndo();
          }
        }
      }

      //t key
      if (e.keyCode === 84) {
        this.moveToDay(new Date());
      }

      //a key
      if (e.keyCode === 65) {
        e.preventDefault();
      }

      //g key
      if (e.keyCode === 71) {
        e.preventDefault();
        let selectedBar = null;
        if (this.selectedBar.length > 0) {
          selectedBar = this.selectedBar[0].i;
          if (selectedBar >= this.state.barData.length-1) {
            selectedBar = -1;
          }
        }
        this.state.barData.forEach((d,i) => {
          if ((selectedBar !== null && i === selectedBar+1) || (selectedBar === null && i === 0)) {
            d.selected = true
          } else {
            d.selected = false
          }
        });
        this.updateBarSelectState();
        if (typeof this.selectedBar[0] !== 'undefined') {
          this.moveToCenter(this.selectedBar[0].d);
        }
      }

      //space key
      if(e.keyCode === 32) {
        e.preventDefault();
        if (this.cursorData.visible.h && this.cursorData.visible.v) {
          if (this.createBar(this.cursorData)) {
            this.cursorData.y += unit;
            this.updateBar();
          }
        }
      }
      //enter key 
      if(e.keyCode === 13) {
        e.preventDefault();
        if (!this.props.readonly) {
          this.onKeyDown_(e);
        }
      }
      //up key 
      if(e.keyCode === 38) {
        e.preventDefault();
        if (e.shiftKey) {
          textPosition(0, -1);
        } else {
          moveTo(0, -unit);
        }
      }
      //down key 
      if(e.keyCode === 40) {
        e.preventDefault();
        if (e.shiftKey) {
          textPosition(0, 1);
        } else {
          moveTo(0, unit);
        }
      }
      //left key 
      if(e.keyCode === 37) {
        e.preventDefault();
        if (e.shiftKey) {
          textPosition(-1, 0);
        } else {
          moveTo(-unit, 0);
        }
      }
      //right key 
      if(e.keyCode === 39) {
        e.preventDefault();
        if (e.shiftKey) {
          textPosition(1, 0);
        } else {
          moveTo(unit, 0);
        }
      }
      //delete key
      if(e.keyCode === 8 || e.keyCode === 46) {
        e.preventDefault();
        if (!this.props.readonly) {
          this.onKeyDown_(e);
        }
      }
      //d key
      if((e.ctrlKey || e.metaKey) && e.keyCode == 68) {
        e.preventDefault();
        const newBars = [];
        if (this.selectedBar.length > 0) {
          this.selectedBar.forEach( b => {
            newBars.push({ ...b.d })
          })
        }
        if (newBars.length > 0) {
          newBars.forEach( b => {
            b.uuid = uuidv4();
            b.y += unit;
          })
          this.setUndo([null], newBars, 'new');
          const bar = this.bar;
          bar.selectAll('path').classed('selected', false).each(d => d.selected = false);
          newBars.forEach( b => {
            this.onCreate(b)
          })
          this.updateBarSelectState();
          this.updateBar();
        }
      }
    }
  }

  handleCopy = (e) => {
    if (document.activeElement.tagName === 'svg') {
      e.preventDefault();
      const bars = (() => {
        if (this.selectedBar.length > 0) {
          const bars = this.selectedBar.map( v => {
            return v.d;
          })
          return [ ...bars ];
        }
        return [ ...this.state.barData ];
      })();
      e.clipboardData.setData('text/plain', Utils.barToCSV(bars)); // copy
    }
  }

  handlePaste = (e) => {
    if (document.activeElement.tagName === 'svg') {
      e.preventDefault();
      const data = e.clipboardData.getData('text/plain');
      const color = Utils.toRGBA(data);
      if (color) {
        this.currentColor = color;
        this.selectedBar.forEach( v => {
          v.d.rgba = color;
        })
        this.updateBarData(this.selectedBar);
        this.updateBarSelectState();
      } else {
        const bars = Utils.CSVtoBar(data).map( d => {
          let i = null;
          this.state.barData.some( (e, j) => {
            e.selected = false;
            if (e.uuid === d.uuid) {
              i = j;
              return true;
            }
            return false;
          })
          if (i === null) {
            d.type = 'roundrect';
            //d.grid = true;
          }
          d.selected = true;
          return {
            d,
            i,
          }
        });
        this.updateBarData(bars);
        this.updateBar();
      }
    }
  }

  setBar = (bar) => {
    let d = null;
    this.state.barData.some( v => {
      if (v.uuid === bar.uuid) {
        d = v;
        return true;
      }
      return false;
    })
    if (d) {
      const org = cloneDeep(d);
      Object.keys(bar).forEach( key => {
        d[key] = bar[key];
      })
      this.setUndo([ org ], [ cloneDeep(d) ]);
      this.updateBarSelectState();
    }
    return d;
  }

  onFocus = (event) => {
    // this.focused = true;
    if (this.focusDelayTimer) clearTimeout(this.focusDelayTimer);
    this.focusDelayTimer = setTimeout(() => {
      this.focusDelayTimer = null;
    }, 300)
  }

  onBlur = (event) => {
    // this.focused = false;
  }

  onKeyDown = (event) => {
    this.shiftKey = event.shiftKey;
  }

  onKeyPress = (event) => {
  }

  onKeyUp = (event) => {
    this.shiftKey = event.shiftKey;
  }

  onMouseMove = (event) => {
  }

  onMouseOut = (event) => {
  }

  onMouseOver = (event) => {
  }

  onMouseUp = (event) => {
  }

  onDoubleClick = (event) => {
  }

  onMouseEnter = (event) => {
  }

  onMouseLeave = (event) => {
    if (this.shiftKey) {
      this.marky.node().width = 0;
      this.marky.node().height = 0;
    }
  }

  moveToDay(date) {
    const time = date.getTime();
    const x = Utils.timePosition(time);
    this.noMoveY = true;
    this.zoomBehavior.translateTo(this.base, x/gridScale, 0);
  }

  moveToCenter(bar) {
    const d = bar;
    const height = this.container.clientHeight;
    this.noMoveY = true;
    this.zoomYPos = (height/2-d.y/gridScale+unit/gridScale);
    this.zoomBehavior.translateTo(this.base, (d.x+d.width/2)/gridScale, 0);
  }

  removeSelectedBar() {
    const barData = [];
    const delData = [];
    this.setUndo(this.state.barData.filter( v => {
      if (v.selected) delData.push(v);
      return v.selected;
    }).map( v => cloneDeep(v) ), null, 'del');
    this.state.barData.forEach( v => {
      if (!v.selected) barData.push(v);
    })
    this.selectedBar = [];
    this.updateScreen(barData);
    return delData;
  }

  insertLine(delta=unit) {
    const barData = [ ...this.state.barData ]
    var data=[];
    var y = this.cursorData.y;
    if (!this.cursorData.visible.h) return;
    // this.state.barData.forEach( v => {
    //   if (v.selected) {
    //     if (y==null || y > v.y) {
    //       y = v.y;
    //     }
    //   }
    // });
    if (delta < 0) {
      for (let i in barData) {
        if (barData[i].y >= y-unit && barData[i].y < y) {
          return
        }
      }
    }
    this.cursorData.y += delta;
    if (y!=null) {
      for (let i in barData) {
        if (barData[i].y >= y) {
          barData[i].y += delta;
          data.push({ d: barData[i], i });
        }
      }
    }
    this.updateBarData(data);
    this.redrawCursor();
  }

  removeLine() {
    this.insertLine(-unit);
  }

  doUndo() {
    if (this.undoPtr > 0) {
      let { barData } = this.state;
      const data = [];
      this.undoPtr--;
      const b = this.undoBuffer[this.undoPtr];
      if (b.action === 'mod') {
        b.oldBars.forEach( bar => {
          barData.some( (d, i) => {
            if (d.uuid === bar.uuid) {
              Object.keys(bar).forEach( key => {
                d[key] = bar[key];
              })
              data.push({ d, i });
              return true;
            }
            return false;
          });
        });
      } else
      if (b.action === 'del') {
        b.oldBars.forEach( bar => {
          barData.push(bar);
          data.push(bar);
        })
      } else
      if (b.action === 'new') {
        const uuids = {}
        b.newBars.forEach( bar => uuids[bar.uuid] = true );
        const newBarData = [];
        barData.forEach( bar => {
          if (!uuids[bar.uuid]) {
            newBarData.push(bar);
            data.push(bar);
          }
        })
        barData = newBarData;
      }
      if (data.length > 0) {
        this.updateScreen(barData);
      }
    }
  }

  doRedo() {
    if (this.undoBuffer.length > this.undoPtr) {
      let { barData } = this.state;
      const data = [];
      const b = this.undoBuffer[this.undoPtr];
      if (b.action === 'mod') {
        b.newBars.forEach( bar => {
          barData.some( (d, i) => {
            if (d.uuid === bar.uuid) {
              Object.keys(bar).forEach( key => {
                d[key] = bar[key];
              })
              data.push({ d, i });
              return true;
            }
            return false;
          });
        });
      } else
      if (b.action === 'del') {
        const uuids = {}
        b.oldBars.forEach( bar => uuids[bar.uuid] = true );
        const newBarData = [];
        barData.forEach( bar => {
          if (!uuids[bar.uuid]) {
            newBarData.push(bar);
            data.push(bar);
          }
        })
        barData = newBarData;
      } else
      if (b.action === 'new') {
        b.newBars.forEach( bar => {
          barData.push(bar);
          data.push(bar);
        })
      }
      this.undoPtr++;
      if (data.length > 0) {
        this.updateScreen(barData);
      }
    }
  }

  setUndo(oldBars, newBars, action='mod') {
    this.undoBuffer = this.undoBuffer.slice(0, this.undoPtr);
    this.undoBuffer.push({
      oldBars: (oldBars) ? oldBars.map( b => cloneDeep(b) ) : [],
      newBars: (newBars) ? newBars.map( b => cloneDeep(b) ) : [],
      action,
    })
    this.undoPtr ++;
  }

  render() {
    return (
      <div
        ref={n => this.container = n}
        style={{
          width: this.props.style.width+2,
          border: 'solid 1px lightgray',
        }}
        // tabIndex={0}
        // focusable={true}
        // onFocus={this.onFocus}
        // onBlur={this.onBlur}
        // onKeyDown={this.onKeyDown}
        // onKeyPress={this.onKeyPress}
        // onKeyUp={this.onKeyUp}
        // onMouseMove={this.onMouseMove}
        // onMouseOut={this.onMouseOut}
        // onMouseOver={this.onMouseOver}
        // onMouseUp={this.onMouseUp}
        // onMouseEnter={this.onMouseEnter}
        // onMouseLeave={this.onMouseLeave}
      >
        <svg
          ref={n => this.svg = d3.select(n)}
          style={{
            ...this.props.style,
          }}
        >
          <defs>
            <mask id="MenuMask" ref={n => this.menuMask = d3.select(n)}>
            </mask>
          </defs>
          <g
            ref={n => this.base = d3.select(n)}
          >
            <rect
              x={0}
              y={0}
              width={"100%"}
              height={"100%"}
              style={{ fill: "rgba(220,255,255,0.4)" }}
            />
            <g ref={n => this.grid = d3.select(n)} />
            <g ref={n => this.cursor = d3.select(n)} />
            <g ref={n => this.bar = d3.select(n)} />
            <g ref={n => this.text = d3.select(n)} />
            <g ref={n => this.marky = d3.select(n)} />
            <g ref={n => this.menu = d3.select(n)} />
            <g ref={n => this.menuInfo = d3.select(n)} mask="url(#MenuMask)" />
            <g ref={n => this.calendar = d3.select(n)} />
            <g ref={n => this.infoBG = d3.select(n)} />
            <g ref={n => this.info = d3.select(n)} />
          </g>
        </svg>
      </div>
    )
  }
}

ScheduleView.defaultProps = {
  barData: [],
  calendarData: {},
  style: {},
  position: {
    x: parseInt(((new Date()).getTime()/unitScale+unit/2)/unit)*unit,
    y: 0,
  },
  menu: {
    width: 100,
    opened: false,
  },
  scale: 1,
  unit,
  unitScale,
  readonly: false,
  focused: false,
}
