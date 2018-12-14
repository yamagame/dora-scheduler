import React, { Component } from 'react';
import * as d3 from 'd3';
import uuidv4 from 'uuid/v4';
import utils from './utils';
import cloneDeep from 'clone-deep';

export const unit = 24;
export const unitScale = 60*60*1000;
export const Utils = utils({ unit, unitScale });

function roundRect(x, y, width, height) {
  const r = height / 2;
  return `M ${x},${y - r} L ${x + width},${y - r} A ${r},${r} 0,0,1 ${x + width},${y + r} L ${x},${y + r} A ${r},${r} 0,0,1 ${x},${y - r} z`;
}

function rect(x1, y1, x2, y2) {
  return `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} z`;
}

function gridFit(self, x) {
  const { unit } = self.props;
  if (x < 0) {
    return parseInt(x/unit)*unit-unit;
  } else {
    return parseInt(x/unit)*unit;
  }
}

function calcBarTitleXPostion(bar, self, d, width) {
  const bbox = bar.getBBox();
  let dx = 0;
  if (self.xScale(d.x+d.width)+bbox.width > width) {
    dx = width-(self.xScale(d.x+d.width)+bbox.width);
  }
  return self.xScale(d.x+d.width)+dx/2;
}

function calcBarTitleYPostion(bar, self, d, width) {
  const { unit } = self.props;
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
      visible: 'hidden',
    }
    this.selectedBar = [];
    this.state = {
      selectDay: null,
      barData: props.barData,
    }
    this.currentColor = [ 0, 255, 0 , 1 ];
    this.focusDelayTimer = null;
    this.undoPtr = 0;
    this.undoBuffer = [];
  }

  componentWillMount() {
    this.focused = false;
  }

  componentDidMount() {
    const self = this;
    const { unit } = self.props;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.clientWidth = width;
    this.clientHeight = height;
    const svg = d3.select(this.svg);

    this.xScale = d3.scaleLinear()
      .domain([0, 0+width])
      .range([0, width]);
    this.yScale = d3.scaleLinear()
      .domain([0, 0+height])
      .range([0, height]);

    this.dragLeftHandle = d3.drag()
      .on('start', function(d, i) {
        var rect = d3.select(this)
        const bar = d3.select(self.bar);

        const selectedBar = cloneDeep(d)

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
        self.updateBarSelectState();

        if (!self.props.readonly && !readOnly(d)) {
          d.ow = d.x+d.width;
          d.ox = self.xScale(d.x);
          d.xx = d.x;
          const dragged = (d) => {
            d.ox += d3.event.dx;
            d.x = self.xScale.invert(d.ox);
            d.width = d.ow-d.x;
            if (d.width < unit) {
              d.x = d.ow-unit;
              d.width = unit;
            }
            self.updateBarSelectState();
          }
          const ended = (d) => {
            let x = Math.floor((d.x+unit/2)/unit)*unit;
            let dx = x-d.x;
            d.x = x;
            d.width -= dx;
            const changed = (d.xx !== d.x);
            delete d.ow;
            delete d.ox;
            delete d.xx;
            if (changed) {
              self.setUndo([ selectedBar ], [ d ]);
              self.updateBarData([{ d, i }]);
            }
            self.updateBarSelectState();
          }
          d3.event.on("drag", dragged).on("end", ended);
        }
      })

    this.dragRightHandle = d3.drag()
      .on('start', function(d, i) {
        var rect = d3.select(this)
        const bar = d3.select(self.bar);

        const selectedBar = cloneDeep(d)

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
        self.updateBarSelectState();

        if (!self.props.readonly && !readOnly(d)) {
          d.ow = d.x;
          d.ox = self.xScale(d.x+d.width);
          d.ww = d.width;
          const dragged = (d) => {
            d.ox += d3.event.dx;
            d.width = self.xScale.invert(d.ox)-d.ow;
            if (d.width < unit) d.width = unit;
            self.updateBarSelectState();
          }
          const ended = (d, i) => {
            d.width = Math.floor((d.width+unit/2)/unit)*unit;
            const changed = (d.ww !== d.width);
            delete d.ow;
            delete d.ox;
            delete d.ww;
            if (changed) {
              self.setUndo([selectedBar], [ d ]);
              self.updateBarData([{ d, i }]);
            }
            self.updateBarSelectState();
          }
          d3.event.on("drag", dragged).on("end", ended);
        }
      })

    this.dragBar = d3.drag()
      .on('start', function(d, i) {
        var rect = d3.select(this)
        const bar = d3.select(self.bar);

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
                  d.x = Math.floor((d.x+unit/2)/unit)*unit;
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
        const marky = d3.select(self.marky);
        const bar = d3.select(self.bar);
        let x = d3.event.x;
        let y = d3.event.y;
        self.markyData.x = d3.event.x;
        self.markyData.y = d3.event.y;
        self.markyData.width = 0;
        self.markyData.height = 0;
        const dragged = (d) => {
          x += d3.event.dx;
          y += d3.event.dy;
          self.markyData.width = x-self.markyData.x;
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
          let x2 = self.xScale.invert(self.markyData.x+self.markyData.width);
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
          }
          self.updateBarSelectState();
        }
        d3.event.on("drag", dragged).on("end", ended);
      })

    let zoomMoved = 0;
    let zoomScale = null;

    this.zoomBehavior = d3.zoom()
      .scaleExtent([1 / 30, 3000])
      .filter(() => {
        return !self.shiftKey;
      })
      .on('start', function() {
        zoomMoved = 0;
        zoomScale = d3.event.transform.k;
      })
      .on('zoom', () => {
        zoomMoved ++;
        if (zoomScale !== d3.event.transform.k) {
          zoomMoved += 10;
        }
        const transform = d3.event.transform;
        transform.rescaleX(this.xScale);
        this.xScale.range([transform.applyX(0), transform.applyX(this.clientWidth)]);
        this.yScale.range([transform.applyY(0), transform.applyY(this.clientHeight)]);
        this.updateGridRectangles();
        this.updateGrid();
        this.updateCalendarRectangles();
        this.updateCalendar();
        const bar = d3.select(this.bar);
        bar.selectAll('path.body')
          .attr('d', this.drawRectangle)
        bar.selectAll('path.left')
          .attr('d', this.drawLeftHandle)
        bar.selectAll('path.right')
          .attr('d', this.drawRightHandle)
        bar.selectAll('text.title')
          .attr('x', function(d) {
            return calcBarTitleXPostion(this, self, d, self.container.clientWidth);
          })
          .attr('y', function(d) {
            return calcBarTitleYPostion(this, self, d, self.container.clientWidth);
          })
          .attr('font-size', this.xScale(16)-this.xScale(0))
        this.redrawCursor();
        this.onChange({
          position: {
            x: -transform.x/transform.k,
            y: -transform.y/transform.k+unit*3,
          },
          scale: transform.k,
        })
      })
      .on('end', function() {
        if (zoomMoved < 5) {
          const bar = d3.select(self.bar);
          if (d3.event.sourceEvent && self.focused && self.focusDelayTimer == null) {
            var coords = d3.mouse(this);
            if (!self.props.readonly) {
              if (coords[1] > self.yScale(unit*3)-self.yScale(0) && self.selectedBar.length === 0) {
                const cx = gridFit(self, self.xScale.invert(coords[0]));
                const cy = gridFit(self, self.yScale.invert(coords[1]));
                if (cx === self.cursorData.x && cy === self.cursorData.y) {
                  self.cursorData.visible = (self.cursorData.visible === 'visible')?'hidden':'visible';
                } else {
                  self.cursorData.visible = 'visible';
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

    svg
      .call(this.zoomBehavior)
      .on('dblclick.zoom', null)
      .call(this.dragMarky);

    this.zoomBehavior
      .scaleTo(svg, this.props.scale);
    this.zoomBehavior
      .translateTo(svg,
        this.props.position.x+this.xScale.invert(this.clientWidth/2)-this.xScale.invert(0),
        this.props.position.y+this.yScale.invert(this.clientHeight/2)-this.yScale.invert(0)-unit*3,
      )

    this.updateGridRectangles();
    this.updateGrid();
    this.updateCalendarRectangles();
    this.updateCalendar();
    this.updateBar();
    this.updateMarky();
    this.updateCursor();
    window.addEventListener('keydown', this.handleShortcuts);
    document.addEventListener('copy', this.handleCopy);
    document.addEventListener('paste', this.handlePaste);
  }

  componentDidUpdate() {
    const width = this.container.clientWidth;
    const self = this;
    this.updateGridRectangles();
    this.updateGrid();
    this.updateCalendarRectangles();
    this.updateCalendar();
    const bar = d3.select(this.bar);
    bar.selectAll('path.body')
      .attr('d', this.drawRectangle)
    bar.selectAll('path.left')
      .attr('d', this.drawLeftHandle)
    bar.selectAll('path.right')
      .attr('d', this.drawRightHandle)
    bar.selectAll('text.title')
      .attr('x', function(d) {
        return calcBarTitleXPostion(this, self, d, width);
      })
      .attr('y', function(d) {
        return calcBarTitleYPostion(this, self, d, width);
      })
      .attr('font-size', this.xScale(16)-this.xScale(0))
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleShortcuts);
    document.removeEventListener('copy', this.handleCopy);
    document.removeEventListener('paste', this.handlePaste);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.barData !== nextProps.barData) {
      this.setState({
        barData: nextProps.barData,
      }, () => {
        this.updateBar();
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
        x + d.width, y+d.height
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

  drawLeftHandle = (d) => {
    const unit = this.props.unit;
    return this.drawRectangle({
      x: d.x,
      y: d.y,
      width: unit/4,
      height: unit,
      type: 'rect',
    })
  }

  drawRightHandle = (d) => {
    const unit = this.props.unit;
    return this.drawRectangle({
      x: d.x+d.width-unit/4,
      y: d.y,
      width: unit/4,
      height: unit,
      type: 'rect',
    })
  }

  updateBarData = (bars) => {
    const barData = [ ...this.state.barData ];
    bars.forEach( v => {
      if (v.i == null) {
        barData.push(v.d);
      } else {
        Object.keys(v.d).forEach( k => {
          barData[v.i][k] = v.d[k];
        })
      }
    })
    this.setState({
      barData,
    }, () => {
      this.onChange({
        bars: barData,
      })
    })
  }

  updateGridRectangles = () => {
    const { unit } = this.props;
    const ox = Math.floor(this.xScale.invert(0) / (unit * 2)) * (unit * 2);
    const oy = Math.floor(this.yScale.invert(0) / (unit * 2)) * (unit * 2);
    const dx = Math.floor(this.xScale.invert(this.container.clientWidth) / (unit * 2)) * (unit * 2);
    const dy = Math.floor(this.yScale.invert(this.container.clientHeight) / (unit * 2)) * (unit * 2);
    this.gridData = []
    for (var y = oy; y < dy + (unit * 2); y += (unit * 2)) {
      this.gridData.push({
        x: 0, y: y, width: unit, height: unit, color: 'rgba(220,255,255,0.5)', type: 'horizontal',
      })
    }
    for (var x = ox; x < dx + (unit * 2); x += (unit * 2)) {
      this.gridData.push({
        x: x, y: 0, width: unit, height: unit, color: 'rgba(220,220,255,0.2)', type: 'vertical',
      })
    }
  }

  updateCalendarRectangles = () => {
    const { unit, unitScale } = this.props;
    this.calendarData = [];
    const r1 = this.xScale.invert(0);
    const x1 = Math.floor(this.xScale.invert(0)/unit)*unit;
    const x2 = this.xScale.invert(this.container.clientWidth);
    const years = {};
    const month = {};
    const unitTime = unit*unitScale;

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
      if (!month[date.getMonth()]) {
        month[date.getMonth()] = { start: startTime, end: endTime  };
      } else {
        month[date.getMonth()].end = endTime;
      }
      let color = "rgba(255,255,255,255)";
      if (day === 0) {
        color = "rgba(255,220,220,255)";
      } else
      if (day === 6) {
        color = "rgba(220,220,255,255)";
      }
      this.calendarData.push({
        x: x, y: unit*2, width: unit, height: unit, color, type: 'calendar', text: date.getDate(), time: date,
      })
    }

    //年
    Object.keys(years).map(v => parseInt(v)).sort().forEach( (k, i) => {
      const v = years[k];
      const color = "rgba(255,255,255,255)";
      this.calendarData.push({
        x: Math.max(v.start/unitScale, r1), y: 0, width: (Math.min(v.end/unitScale, x2)-Math.max(v.start/unitScale, r1)), height: unit, color, type: 'calendar', text: k,
      })
    })

    //月
    Object.keys(month).map(v => parseInt(v)).sort().forEach( (k, i) => {
      const v = month[k];
      const date = new Date(v.start);
      let color;
      if ((date.getMonth() % 2) === 0) {
        color = "rgba(235,235,235,255)";
      } else {
        color = "rgba(225,225,225,255)";
      }
      this.calendarData.push({
        x: Math.max(v.start/unitScale, r1), y: unit, width: (Math.min(v.end/unitScale, x2)-Math.max(v.start/unitScale, r1)), height: unit, color, type: 'calendar', text: k+1,
      })
    })
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
    const x = parseInt((today.getTime()/unitScale+unit/2)/unit)*unit;
    return [
      { x: x, y: unit*2, height: unit, width: unit, color: 'rgba(0,255,0,0.6)', type: 'calendar-circle', }
    ]
  }

  calendarSelectRectangles = () => {
    const { unit, unitScale } = this.props;
    if (this.state.selectDay) {
      const x = this.state.selectDay.getTime()/unitScale;
      return [
        { x, y: unit*2, height: unit, width: unit, color: 'rgba(128,255,0,0.2)', type: 'calendar-select', }
      ]
    }
    return [];
  }

  updateGrid = () => {
    const grid = d3.select(this.grid);
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
  }

  updateCalendar = () => {
    const { unit, } = this.props;
    const calendar = d3.select(this.calendar);
    calendar
      .selectAll('path')
      .remove();
    calendar
      .selectAll('text')
      .remove();
    calendar
      .selectAll('path.date')
      .data(this.calendarRectangles())
      .enter()
      .append('path')
      .attr('class', 'date')
      .attr('stroke', 'lightgray')
      .attr('stroke-width', 1)
      .attr('fill', (d) => {
        if (d.selected) {
          return ('color' in d) ? d.color : `rgba(${d.rgba[0]*0.8},${d.rgba[1]*0.8},${d.rgba[2]*0.8},${d.rgba[3]})`;
        }
        return ('color' in d) ? d.color : `rgba(${d.rgba[0]},${d.rgba[1]},${d.rgba[2]},${d.rgba[3]})`;
      })
      .attr('d', this.drawRectangle)
      .on('click', (d) => {
        if (d.time) {
          if (this.state.selectDay && d.time.getTime() === this.state.selectDay.getTime()) {
            this.setState({
              selectDay: null,
            })
          } else {
            this.setState({
              selectDay: d.time,
            })
          }
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
      .data(this.calendarRectangles())
      .enter()
      .append('text')
      .attr('x', d => this.xScale(d.x+d.width/2))
      .attr('y', d => this.yScale(d.y+unit*3/4)-this.yScale(0))
      .text(d => d.text)
      .attr("text-anchor", "middle")
      .attr("vertical-align", "middle")
      .attr('font-size', this.xScale(16)-this.xScale(0))
      .attr("fill", "black")
      .style('pointer-events', 'none')

    calendar
      .selectAll('path')
      .attr('d', this.drawRectangle)
      .attr('fill', (d) => {
        if (d.selected) {
          return ('color' in d) ? d.color : `rgba(${d.rgba[0]*0.8},${d.rgba[1]*0.8},${d.rgba[2]*0.8},${d.rgba[3]})`;
        }
        return ('color' in d) ? d.color : `rgba(${d.rgba[0]},${d.rgba[1]},${d.rgba[2]},${d.rgba[3]})`;
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
    const bar = d3.select(this.bar);
    self.selectedBar = [];

    bar.selectAll('g')
      .remove();

    const path = bar
      .selectAll('g.bar')
      .data(this.barRectangles())
 
    const g = path.enter()
      .append('g')
      .classed('bar', true)
      .attr('x', 0)
      .attr('y', 0);

    path.exit()
      .remove();

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
        if (d.selected) {
          return ('color' in d) ? d.color : `rgba(${d.rgba[0]*0.8},${d.rgba[1]*0.8},${d.rgba[2]*0.8},${d.rgba[3]})`;
        }
        return ('color' in d) ? d.color : `rgba(${d.rgba[0]},${d.rgba[1]},${d.rgba[2]},${d.rgba[3]})`;
      })
      .attr('d', this.drawRectangle)
      .style('cursor', 'move')
      .call(this.dragBar)
      .on('dblclick',function(d, i){
        self.onEdit(d, i);
      })

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

    g.append('g')
      .append('text')
      .classed('title', true)
      .attr('x', function(d) {
        return calcBarTitleXPostion(this, self, d, self.container.clientWidth);
      })
      .attr('y', function(d) {
        return calcBarTitleYPostion(this, self, d, self.container.clientWidth);
      })
      .attr('font-size', this.xScale(16)-this.xScale(0))
      .style('pointer-events', 'none')
      .text(d => d.title)
      .attr("text-anchor", "start")
      .attr("alignment-baseline", "baseline")

    g.exit().remove()

    this.redrawCursor();
  }

  updateBarSelectState = (redraw=true) => {
    const self = this;
    const bar = d3.select(this.bar);
    self.selectedBar = [];
    bar
      .selectAll('path.body')
      .each((d,i) => {
        if (d.selected) {
          self.selectedBar.push({ d, i });
        }
      })
      .attr('fill', (d) => {
        if (d.selected) {
          return ('color' in d) ? d.color : `rgba(${d.rgba[0]*0.8},${d.rgba[1]*0.8},${d.rgba[2]*0.8},${d.rgba[3]})`;
        }
        return ('color' in d) ? d.color : `rgba(${d.rgba[0]},${d.rgba[1]},${d.rgba[2]},${d.rgba[3]})`;
      })
      .attr('d', this.drawRectangle)
    bar
      .selectAll('path.left')
      .attr('d', this.drawLeftHandle)
    bar
      .selectAll('path.right')
      .attr('d', this.drawRightHandle)
    bar
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
    const marky = d3.select(this.marky);
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
      visible: this.cursorData.visible,
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
      visible: this.cursorData.visible,
    };
  }

  updateCursor = () => {
    const cursor = d3.select(this.cursor);
    cursor
      .selectAll('path.cursor')
      .data([this.cursorRectangles()])
      .enter()
      .append('path')
      .attr('class', 'cursor')
      //.style("pointer-events", "none")
      .attr('visibility', d => this.cursorData.visible)
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
      .attr('visibility', d => this.cursorData.visible)
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
      .attr('visibility', d => this.cursorData.visible)
      .attr('stroke', 'none')
      .attr('stroke-width', 2)
      .attr('fill', (d) => d.color ? d.color : 'none')
      .attr('d', this.drawRectangle)
  }

  redrawCursor = () => {
    const cursor = d3.select(this.cursor);
    cursor.selectAll('path.cursor')
      .data([this.cursorRectangles()])
      .attr('visibility', d => this.cursorData.visible)
      .attr('d', this.drawRectangle)
    cursor.selectAll('path.v-cursor')
      .data([this.cursorVRectangles()])
      .attr('visibility', d => this.cursorData.visible)
      .attr('d', this.drawRectangle)
    cursor.selectAll('path.h-cursor')
      .data([this.cursorHRectangles()])
      .attr('visibility', d => this.cursorData.visible)
      .attr('d', this.drawRectangle)
  }

  handleShortcuts = (e) => {
    if (this.focused) {

      const move = (x, y) => {
        if (!this.props.readonly) {
          this.selectedBar.forEach( v => {
            if (!readOnly(v.d)) {
              v.d.x += x;
            }
            v.d.y += y;
          })
          this.updateBarData(this.selectedBar);
          this.updateBarSelectState();
        }
      }

      //command+z
      if(e.metaKey && e.keyCode === 90) {
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
        if (this.cursorData.visible === 'visible') {
          const bar = {
            uuid: uuidv4(),
            x: this.cursorData.x,
            y: this.cursorData.y,
            width: unit,
            height: unit,
            title: '',
            text: '',
            type: 'roundrect',
            grid: true,
            rgba: this.currentColor,
            selected: true,
          }
          this.setUndo([null], [bar], 'new');
          this.onCreate(bar)
          this.cursorData.y += unit;
          this.updateBar();
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
        move(0, -unit);
      }
      //down key 
      if(e.keyCode === 40) {
        e.preventDefault();
        move(0, unit);
      }
      //left key 
      if(e.keyCode === 37) {
        e.preventDefault();
        move(-unit, 0);
      }
      //right key 
      if(e.keyCode === 39) {
        e.preventDefault();
        move(unit, 0);
      }
      //delete key
      if(e.keyCode === 8 || e.keyCode === 46) {
        e.preventDefault();
        if (!this.props.readonly) {
          this.onKeyDown_(e);
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
    this.focused = true;
    if (this.focusDelayTimer) clearTimeout(this.focusDelayTimer);
    this.focusDelayTimer = setTimeout(() => {
      this.focusDelayTimer = null;
    }, 300)
  }

  onBlur = (event) => {
    this.focused = false;
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
      this.marky.width = 0;
      this.marky.height = 0;
    }
  }

  moveToDay(date) {
    const time = date.getTime();
    // const width = this.clientWidth;
    const height = this.clientHeight;
    // const ox = this.xScale.invert(0);
    const oy = this.yScale.invert(0);
    // const ow = this.xScale.invert(width)-ox;
    const oh = this.yScale.invert(height)-oy;
    const x = Utils.timePosition(time);
    const svg = d3.select(this.svg);
    this.zoomBehavior.translateTo(svg, x, oy+oh/2);
  }

  moveToCenter(bar) {
    const d = bar;
    // const width = this.clientWidth;
    // const height = this.clientHeight;
    // const ox = this.xScale.invert(0);
    // const oy = this.yScale.invert(0);
    // const ow = this.xScale.invert(width)-ox;
    // const oh = this.yScale.invert(height)-oy;
    const svg = d3.select(this.svg);
    this.zoomBehavior.translateTo(svg, d.x+d.width/2, d.y+d.height/2-unit);
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
    var data=[];
    var y;
    this.state.barData.forEach( v => {
      if (v.selected) {
        if (y==null || y > v.y) {
          y = v.y;
        }
      }
    });
    if (delta < 0) {
      for (let i in this.state.barData) {
        if (this.state.barData[i].y >= y-unit && this.state.barData[i].y < y) {
          return
        }
      }
    }
    if (y!=null) {
      for (let i in this.state.barData) {
        const barData = [ ...this.state.barData ]
        if (barData[i].y >= y) {
          barData[i].y += delta;
        }
        data.push({ d: barData[i], i });
      }
    }
    this.updateBarData(data);
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
      >
        <svg
          ref={n => this.svg = n}
          style={{
            ...this.props.style,
          }}
          tabIndex={0}
          focusable={true}
          onFocus={this.onFocus}
          onBlur={this.onBlur}
          onKeyDown={this.onKeyDown}
          onKeyPress={this.onKeyPress}
          onKeyUp={this.onKeyUp}
          onMouseMove={this.onMouseMove}
          onMouseOut={this.onMouseOut}
          onMouseOver={this.onMouseOver}
          onMouseUp={this.onMouseUp}
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
        >
          <g
            ref={n => this.base = n}
          >
            <rect
              x={0}
              y={0}
              width={"100%"}
              height={"100%"}
              style={{ fill: "rgba(220,255,255,0.4)" }}
            />
            <g ref={n => this.grid = n} />
            <g ref={n => this.cursor = n} />
            <g ref={n => this.bar = n} />
            <g ref={n => this.marky = n} />
            <g ref={n => this.calendar = n} />
          </g>
        </svg>
      </div>
    )
  }
}

ScheduleView.defaultProps = {
  barData: [],
  style: {},
  position: {
    x: parseInt(((new Date()).getTime()/unitScale+unit/2)/unit)*unit,
    y: 0,
  },
  scale: 1,
  unit,
  unitScale,
  readonly: false,
}
