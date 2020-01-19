import React, { Component } from 'react';
import styled from 'styled-components'
import { useTable } from 'react-table'
import { FixedSizeList } from 'react-window'
import {
  Button,
} from 'react-bootstrap';

const Styles = styled.div`
  .table {
    display: inline-block;
    border-spacing: 0;
    border: 1px solid lightgray;
    font-size: 14px;
    
    .th {
      color: white;
      background-color: #317bff;
      font-weight: bold;
    }

    .tr {
      border-bottom: 1px solid lightgray;
    }

    .th,
    .td {
      margin: 0;
      padding: 0.3rem;
      padding-left: 0.5rem;

      :last-child {
        border-right: 0;
      }
    }

    .selected {
      background-color: #f5ffa0;
    }

    .header {
      border-bottom: 2px solid lightgray;
    }
  }
`

function Table({ columns, filename, data, height, onSelect }) {
  // Use the state and functions returned from useTable to build your UI
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    totalColumnsWidth,
    prepareRow,
  } = useTable(
    {
      columns,
      data,
    }
  )

  const RenderRow = React.useCallback(
    ({ index, style }) => {
      const row = rows[index]
      prepareRow(row)
      return (
        <div
          {...row.getRowProps({
            style,
          })}
          className={row.values.filename === filename ? "tr selected" : "tr"}
          onClick={() => {
            onSelect(row.values.filename);
          }}
        >
          {row.cells.map(cell => {
            return (
              <div {...cell.getCellProps()} className="td">
                {cell.render('Cell')}
              </div>
            )
          })}
        </div>
      )
    },
    [prepareRow, rows]
  )

  // Render the UI for your table
  return (
    <div {...getTableProps()} className="table">
      <div>
        {headerGroups.map(headerGroup => (
          <div {...headerGroup.getHeaderGroupProps()} className="tr header">
            {headerGroup.headers.map(column => (
              <div {...column.getHeaderProps()} className="th">
                {column.render('Header')}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div {...getTableBodyProps()}>
        <FixedSizeList
          height={height-165}
          itemCount={rows.length}
          itemSize={35}
          width="100%"
        >
          {RenderRow}
        </FixedSizeList>
      </div>
    </div>
  )
}

export default function({ width, height, filename, data, onSelect, onOpen, onClose, onCreate, onDelete  }) {
  return <div>
    <div className="App-header">
      <nav className="navbar sticky-top navbar-light bg-light">
        <div style={{ display: 'inherit', }}>
          <button
            style={{ marginRight: 10, }}
            className="btn btn-sm btn-outline-secondary"
            type="button"
            onClick={onCreate}
          >新規作成</button>
          <button
            style={{ marginRight: 10, }}
            className="btn btn-sm btn-outline-secondary"
            type="button"
            onClick={onDelete}
          >削除</button>
        </div>
      </nav>
    </div>
    <div
      style={{
        width: width-30,
        height: height-30-25+4-25,
        margin: 10,
      }}
    >
      <Styles><Table
        height={height}
        filename={filename}
        columns={[ { Header: 'ファイル名', accessor: 'filename', } ]}
        data={data}
        onSelect={onSelect}
      /></Styles>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginRight: 10, }}>
        <Button className="btn btn-sm" variant="secondary" style={{marginRight: 10}} onClick={onClose}>キャンセル</Button>
        <Button className="btn btn-sm" variant="primary" onClick={onOpen}>読み込み</Button>
      </div>
    </div>
  </div>
}
