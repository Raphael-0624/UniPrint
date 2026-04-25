import React, { useRef, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { Button, Space, Select, Input, Modal, Spin, Progress, Slider } from 'antd';
import { FileDoneOutlined, CloseOutlined, PictureOutlined, FilePdfOutlined, PrinterOutlined } from '@ant-design/icons';
import { setColumns } from '../store/tableSlice';
import html2canvas from 'html2canvas';
import { message } from 'antd';

const PrintPreview: React.FC = () => {
  const dispatch = useDispatch();
  const { data, columns } = useSelector((state: RootState) => state.table);
  
  // 基础状态
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [title, setTitle] = useState<string>('');
  const componentRef = useRef<any>(null);
  
  // 内边距和外边距状态
  const [cellPadding, setCellPadding] = useState<number>(5);
  const [outerMargin, setOuterMargin] = useState<number>(10);
  const [showPaddingModal, setShowPaddingModal] = useState(false);
  const [showMarginModal, setShowMarginModal] = useState(false);
  
  // 列显示控制
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  // 标签功能
  const [tagColumns, setTagColumns] = useState<string[]>([]);

  // 父记录功能 - 选择哪个字段作为父记录标识
  const [parentColumn, setParentColumn] = useState<string>('');

  // 分组功能
  const [groupColumns, setGroupColumns] = useState<string[]>([]);

  // 分页状态
  const [isPaginated, setIsPaginated] = useState<boolean>(false);
  const [, setPageHeight] = useState<number>(0);
  const [, setTotalPages] = useState<number>(0);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportType, setExportType] = useState('');
  const [isExportCancelled, setIsExportCancelled] = useState(false);

  // 分页计算状态
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [paginationProgress, setPaginationProgress] = useState(0);
  const [paginatedData, setPaginatedData] = useState<any[][]>([]);

  // 列宽调整状态
  const [resizing, setResizing] = useState<{ index: number; startX: number; startWidth: number } | null>(null);

  // 更新可见列当列变化时 - 使用 useEffect 确保 columns 加载完成后再设置
  React.useEffect(() => {
    if (columns && columns.length > 0) {
      setVisibleColumns(columns.map(col => col.field));
    }
  }, [columns]);

  // 过滤后的列
  const filteredColumns = useMemo(() => {
    return columns.filter(col => visibleColumns.includes(col.field));
  }, [columns, visibleColumns]);

  // 判断是否为数字类型
  const isNumeric = (value: any): boolean => {
    if (value === null || value === undefined || value === '') return false;
    const num = Number(value);
    return !isNaN(num) && !isNaN(parseFloat(String(value)));
  };

  // 计算字体大小
  const calculateFontSize = () => {
    const containerWidth = orientation === 'portrait' ? 210 - 20 : 297 - 20;
    const containerWidthPx = containerWidth * 3.7795;
    const totalColumnWidth = filteredColumns.reduce((sum, col) => sum + (col.width || 150), 0);
    const baseFontSize = 12;
    
    if (totalColumnWidth > containerWidthPx) {
      const scale = containerWidthPx / totalColumnWidth;
      return Math.max(8, Math.floor(baseFontSize * scale));
    }
    return baseFontSize;
  };

  const fontSize = calculateFontSize();

  // 处理列宽调整
  const handleMouseDown = (e: React.MouseEvent, index: number, th: HTMLTableCellElement) => {
    e.preventDefault();
    setResizing({
      index,
      startX: e.clientX,
      startWidth: th.offsetWidth
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (resizing) {
      const { index, startX, startWidth } = resizing;
      const newWidth = Math.max(50, Math.min(1200, startWidth + (e.clientX - startX)));
      
      // 获取当前拖拽的列的 field
      const currentColumn = filteredColumns[index];
      if (!currentColumn) return;
      
      const th = document.querySelector(`th:nth-child(${index + 1})`) as HTMLElement;
      const tds = document.querySelectorAll(`td:nth-child(${index + 1})`);
      
      if (th) th.style.width = `${newWidth}px`;
      tds.forEach(td => {
        (td as HTMLElement).style.width = `${newWidth}px`;
      });
      
      // 使用 field 来找到正确的列并更新
      const newColumns = columns.map((col) =>
        col.field === currentColumn.field ? { ...col, width: newWidth } : col
      );
      dispatch(setColumns(newColumns));
    }
  };

  const handleMouseUp = () => {
    setResizing(null);
  };

  React.useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing]);

  // 基于实际 DOM 测量的分页计算
  const calculatePaginationWithMeasurement = async () => {
    setPaginationLoading(true);
    setPaginationProgress(0);
    
    // 等待 DOM 完全渲染 - 使用更长的延迟确保首次渲染完成
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 再次使用 requestAnimationFrame 确保浏览器完成布局计算
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
    
    const previewContainer = document.querySelector('.preview-container');
    if (!previewContainer) {
      console.error('previewContainer not found');
      setPaginationLoading(false);
      return;
    }
    
    // 检查必要数据是否准备好
    if (!processedData || processedData.length === 0) {
      console.error('processedData is empty');
      setPaginationLoading(false);
      return;
    }
    
    if (!filteredColumns || filteredColumns.length === 0) {
      console.error('filteredColumns is empty');
      setPaginationLoading(false);
      return;
    }
    
    // 获取页面尺寸 - 使用表格实际宽度或容器宽度（取较大值）
    const tableElement = document.querySelector('.preview-container table');
    const containerWidth = previewContainer.clientWidth;
    const tableWidthActual = tableElement ? tableElement.scrollWidth : 0;
    const widthX = Math.max(containerWidth, tableWidthActual, 800); // 最小800px
    
    // A4 纸尺寸：210mm x 297mm
    // 转换为像素 (1mm = 3.7795px)
    const a4WidthPx = 210 * 3.7795;  // ~794px
    const a4HeightPx = 297 * 3.7795; // ~1123px
    
    // 页面高度使用 A4 标准高度，不随宽度变化
    const pageHeight = orientation === 'portrait' ? a4HeightPx : a4WidthPx;
    
    // 先创建测量容器来测量实际高度
    const measureContainer = document.createElement('div');
    measureContainer.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: ${widthX}px;
      opacity: 0;
      pointer-events: none;
      z-index: -9999;
      overflow: hidden;
      height: auto;
    `;
    document.body.appendChild(measureContainer);
    
    // 强制浏览器回流，确保后续高度测量准确
    measureContainer.getBoundingClientRect();
    
    // 计算表格宽度（使用用户配置的外边距）
    const tableWidth = widthX - (outerMargin * 2);
    
    // 测量标题实际高度
    let actualTitleHeight = 0;
    if (title) {
      const titleEl = document.createElement('h1');
      titleEl.style.cssText = 'font-size: 14px; font-weight: bold; text-align: left; margin-bottom: 12px;';
      titleEl.textContent = title;
      measureContainer.appendChild(titleEl);
      // 强制回流并等待
      await new Promise(resolve => requestAnimationFrame(resolve));
      titleEl.getBoundingClientRect();
      actualTitleHeight = titleEl.offsetHeight + 12; // 包含 margin-bottom
      measureContainer.removeChild(titleEl);
    }
    
    // 测量表头实际高度
    const headerTable = document.createElement('table');
    headerTable.style.cssText = `
      width: ${tableWidth}px;
      border-collapse: collapse;
      font-size: ${fontSize}px;
      table-layout: fixed;
    `;
    const headerThead = document.createElement('thead');
    headerThead.style.backgroundColor = '#f5f5f5';
    const headerTr = document.createElement('tr');
    filteredColumns.forEach(col => {
      const th = document.createElement('th');
      th.style.cssText = `
        border: 0.5px solid #ddd;
        padding: ${cellPadding}px;
        font-weight: bold;
        width: ${col.width || 150}px;
        white-space: nowrap;
      `;
      th.textContent = col.headerName;
      headerTr.appendChild(th);
    });
    headerThead.appendChild(headerTr);
    headerTable.appendChild(headerThead);
    measureContainer.appendChild(headerTable);
    // 强制回流并等待
    await new Promise(resolve => requestAnimationFrame(resolve));
    headerTable.getBoundingClientRect();
    const actualHeaderHeight = headerTr.offsetHeight || 30; // 如果测量失败使用默认值
    measureContainer.removeChild(headerTable);
    
    // 计算可用高度（使用实际测量的高度）
    // 内容区域 = pageHeight - 上下padding(outerMargin * 2)
    const contentHeight = pageHeight - outerMargin * 2;
    
    // 第一页可用高度 = 内容区域 - 标题高度 - 表头高度
    let availableHeight = contentHeight - actualTitleHeight - actualHeaderHeight;
    
    // 确保可用高度至少为 100px，避免分页逻辑出错
    if (availableHeight < 100) {
      console.warn('Available height too small, using default:', availableHeight);
      availableHeight = Math.max(100, contentHeight * 0.6); // 至少使用内容区域高度的 60%
    }
    
    console.log('Pagination calculation:', {
      widthX,
      pageHeight,
      actualTitleHeight,
      actualHeaderHeight,
      availableHeight,
      processedDataLength: processedData.length
    });
    
    setPaginationProgress(20);
    
    // 准备所有需要测量的行数据
    const allRows: { type: 'group' | 'data'; data: any; height: number }[] = [];
    
    // 构建测量用的表格
    // 注意：测量时的表格宽度应该与分页渲染时的可用宽度一致
    // 分页渲染时，page的padding是outerMargin，table的width是100%
    // 所以测量表格的宽度应该是 widthX - (outerMargin * 2) (左右padding)
    const measureTable = document.createElement('table');
    measureTable.style.cssText = `
      width: ${tableWidth}px;
      border-collapse: collapse;
      font-size: ${fontSize}px;
      table-layout: fixed;
    `;
    
    // 添加表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    filteredColumns.forEach(col => {
      const th = document.createElement('th');
      th.style.cssText = `
        border: 0.5px solid #ddd;
        padding: ${cellPadding}px;
        font-weight: bold;
        width: ${col.width || 150}px;
      `;
      th.textContent = col.headerName;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    measureTable.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    // 添加所有行到测量表格
    processedData.forEach((item, index) => {
      if (item.isGroup) {
        // 分组标题行
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = filteredColumns.length;
        td.style.cssText = `
          border: 0.5px solid #ddd;
        padding: 8px;
        font-weight: bold;
        background-color: #f0f0f0;
        padding-left: ${8 + item.level * 4}px;
      `;
      td.innerHTML = `${item.groupValue}<span style="margin-left: 8px; color: #999; font-weight: normal;">(${item.count})</span>`;
        tr.appendChild(td);
        tbody.appendChild(tr);
        allRows.push({ type: 'group', data: item, height: 0 });
      } else if (item.isData || item.data) {
        // 数据行
        const rowsToRender = item.isData ? [item] : buildTreeData(item.data);
        rowsToRender.forEach((row: any) => {
          const tr = document.createElement('tr');
          filteredColumns.forEach((col, colIndex) => {
            const td = document.createElement('td');
            const value = row[col.field] || '';
            const isNumber = !isNaN(Number(value)) && value !== '';
            
            td.style.cssText = `
            border: 0.5px solid #ddd;
            padding: ${cellPadding}px;
            text-align: ${isNumber ? 'right' : 'left'};
            width: ${col.width || 150}px;
          `;
            
            // 处理标签样式
            if (tagColumns.includes(col.field)) {
              const span = document.createElement('span');
              const bgColors = ['#e6f7ff', '#f6ffed', '#fffbe6', '#fff1f0', '#f9f0ff', '#e6fffb', '#fff0f6', '#fff2e8'];
              const bgIndex = String(value).length % bgColors.length;
              span.style.cssText = `
                display: inline;
                background-color: ${bgColors[bgIndex]};
                border-radius: 4px;
                color: #000;
                white-space: nowrap;
                padding: 0 6px;
                line-height: 1;
                vertical-align: baseline;
              `;
              span.textContent = String(value);
              td.appendChild(span);
            } else {
              td.textContent = String(value);
            }
            
            // 处理子记录缩进
            if (row.level > 0 && colIndex === 0) {
              td.style.paddingLeft = `${20 + row.level * 20}px`;
              const prefix = document.createElement('span');
              prefix.style.cssText = 'margin-right: 4px; color: #999;';
              prefix.textContent = '└─';
              td.insertBefore(prefix, td.firstChild);
            }
            
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
          allRows.push({ type: 'data', data: row, height: 0 });
        });
      }
      
      // 更新进度
      if (index % 10 === 0) {
        const progress = 30 + Math.round((index / processedData.length) * 40);
        setPaginationProgress(progress);
      }
    });
    
    measureTable.appendChild(tbody);
    
    // 创建一个与分页渲染时相同的 table-container
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
      overflow: auto;
      width: 100%;
    `;
    tableContainer.appendChild(measureTable);
    measureContainer.appendChild(tableContainer);
    
    setPaginationProgress(70);
    
    // 强制回流，确保高度计算准确 - 使用 await 确保浏览器完成布局
    await new Promise(resolve => requestAnimationFrame(resolve));
    measureTable.getBoundingClientRect();
    
    // 测量每行高度
    const measuredRows = tbody.querySelectorAll('tr');
    let zeroHeightCount = 0;
    measuredRows.forEach((tr, index) => {
      if (index < allRows.length) {
        // 强制回流每个行元素
        tr.getBoundingClientRect();
        const height = tr.offsetHeight || tr.getBoundingClientRect().height || 30;
        allRows[index].height = height > 0 ? height : 30; // 如果测量失败，使用默认高度 30
        if (height <= 0) zeroHeightCount++;
      }
    });
    
    console.log('Row heights measured:', {
      totalRows: measuredRows.length,
      zeroHeightCount,
      sampleHeights: allRows.slice(0, 5).map(r => r.height)
    });
    
    setPaginationProgress(80);
    
    // 清理测量容器
    document.body.removeChild(measureContainer);
    
    // 根据实际高度进行分页
    const pages: any[][] = [];
    let currentPage: any[] = [];
    let currentHeight = 0;
    let isFirstPage = true;
    
    // 第一页可用高度（包含标题）
    const firstPageAvailableHeight = availableHeight;
    // 后续页可用高度（不包含标题）
    const subsequentPageAvailableHeight = contentHeight - actualHeaderHeight;
    
    allRows.forEach((row) => {
      // 根据是否是第一页，使用不同的可用高度
      const currentAvailableHeight = isFirstPage ? firstPageAvailableHeight : subsequentPageAvailableHeight;
      
      // 如果当前行加入后会超出可用高度，且当前页已有内容，则创建新页
      if (currentHeight + row.height > currentAvailableHeight && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentHeight = 0;
        isFirstPage = false;  // 创建新页后，不再是第一页
      }
      
      currentPage.push(row.data);
      currentHeight += row.height;
    });
    
    // 添加最后一页
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    
    console.log('Pagination result:', {
      totalPages: pages.length,
      firstPageAvailableHeight,
      subsequentPageAvailableHeight,
      totalRows: allRows.length
    });
    
    setPaginationProgress(100);
    setPaginatedData(pages);
    setTotalPages(pages.length);
    setPageHeight(pageHeight);
    
    // 延迟关闭 loading
    setTimeout(() => {
      setPaginationLoading(false);
    }, 300);
  };

  const handleTogglePagination = async () => {
    if (isPaginated) {
      setIsPaginated(false);
      setPaginatedData([]);
    } else {
      // 首次点击：先开启，再关闭，再重启，确保数据完全准备好
      setIsPaginated(true);
      
      // 等待第一次渲染完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 关闭分页
      setIsPaginated(false);
      setPaginatedData([]);
      
      // 等待关闭完成
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 重新开启并计算分页
      setIsPaginated(true);
      calculatePaginationWithMeasurement();
    }
  };

  // 渲染标签样式 - 黑字浅色背景，小圆角，无边框
  const renderTag = (value: string) => {
    if (!value) return null;
    // 浅色背景色板
    const bgColors = ['#e6f7ff', '#f6ffed', '#fffbe6', '#fff1f0', '#f9f0ff', '#e6fffb', '#fff0f6', '#fff2e8'];
    const index = value.length % bgColors.length;
    return (
      <span style={{
        display: 'inline',
        backgroundColor: bgColors[index],
        borderRadius: '4px',
        color: '#000', // 字体始终为黑色
        whiteSpace: 'nowrap',
        padding: '0 6px',
        lineHeight: '1',
        verticalAlign: 'baseline'
      }}>
        {value}
      </span>
    );
  };

  // 渲染单元格内容
  const renderCell = (row: any, column: any) => {
    const value = row[column.field] || '';
    
    // 标签样式
    if (tagColumns.includes(column.field)) {
      return renderTag(value);
    }
    
    return <span>{value}</span>;
  };

  // 渲染分组值（支持标签样式）
  const renderGroupValue = (value: string, columnField: string) => {
    if (tagColumns.includes(columnField)) {
      return renderTag(value);
    }
    return <span>{value}</span>;
  };

  // 处理数据分组和层级结构 - 支持多级分组和标签样式
  const processedData = useMemo(() => {
    let result: any[] = [];
    
    // 如果有分组
    if (groupColumns.length > 0) {
      // 构建多级分组结构
      const buildNestedGroups = (rows: any[], level: number = 0): any[] => {
        if (level >= groupColumns.length) {
          return rows.map(row => ({ ...row, isData: true }));
        }
        
        const currentGroupColumn = groupColumns[level];
        const groupMap = new Map();
        
        rows.forEach((row) => {
          const groupValue = row[currentGroupColumn];
          if (!groupMap.has(groupValue)) {
            groupMap.set(groupValue, {
              key: groupValue,
              data: [],
              level: level, // 第0个分组字段level=0，第1个level=1，以此类推
              groupValue: groupValue,
              groupColumn: currentGroupColumn,
              isGroup: true,
              count: 0 // 分组下的数据数量
            });
          }
          groupMap.get(groupValue).data.push(row);
        });
        
        const groups: any[] = [];
        groupMap.forEach((group) => {
          // 递归处理下一级分组
          group.children = buildNestedGroups(group.data, level + 1);
          // 计算该分组下的实际数据数量（只统计最底层的数据行）
          group.count = group.data.length;
          groups.push(group);
        });
        
        return groups;
      };
      
      // 扁平化分组结构
      const flattenGroups = (groups: any[]): any[] => {
        const result: any[] = [];
        groups.forEach(group => {
          if (group.isGroup) {
            result.push(group);
            if (group.children) {
              result.push(...flattenGroups(group.children));
            }
          } else {
            result.push(group);
          }
        });
        return result;
      };
      
      const nestedGroups = buildNestedGroups(data);
      result = flattenGroups(nestedGroups);
    } else {
      result = [{ key: 'all', data: data.map((row, idx) => ({ ...row, originalIndex: idx })), level: 0, isGroup: false }];
    }
    
    return result;
  }, [data, groupColumns, tagColumns]);

  // 构建树形结构（用于父记录功能）
  const buildTreeData = (rows: any[]): any[] => {
    if (!parentColumn) return rows.map(r => ({ ...r, level: 0, isChild: false }));
    
    const rowMap = new Map();
    const rootRows: any[] = [];
    
    // 首先建立映射
    rows.forEach(row => {
      rowMap.set(row[parentColumn], { ...row, children: [], level: 0, isChild: false });
    });
    
    // 构建树形结构
    rows.forEach(row => {
      const current = rowMap.get(row[parentColumn]);
      // 查找是否有其他行以当前行的parentColumn值作为标识
      // 简化处理：如果某行的parentColumn值等于另一行的某个字段值，则建立父子关系
      const parentValue = row[parentColumn];
      let foundParent = false;
      
      rows.forEach((potentialParent) => {
        if (potentialParent !== row) {
          // 检查 potentialParent 的某个字段是否等于 parentValue
          Object.values(potentialParent).forEach((val: any) => {
            if (String(val) === String(parentValue) && !foundParent) {
              const parent = rowMap.get(potentialParent[parentColumn]);
              if (parent) {
                parent.children.push(current);
                current.isChild = true;
                current.parent = parent;
                foundParent = true;
              }
            }
          });
        }
      });
      
      if (!foundParent) {
        rootRows.push(current);
      }
    });
    
    // 扁平化树形结构
    const flattenTree = (nodes: any[], level: number = 0): any[] => {
      const result: any[] = [];
      nodes.forEach(node => {
        result.push({ ...node, level });
        if (node.children && node.children.length > 0) {
          result.push(...flattenTree(node.children, level + 1));
        }
      });
      return result;
    };
    
    return flattenTree(rootRows);
  };

  // 导出功能
  const handleExportImages = async () => {
    if (!isPaginated) return;
    
    setExportLoading(true);
    setExportType('图片');
    setExportProgress(0);
    setIsExportCancelled(false);
    
    try {
      const pages = document.querySelectorAll('.print-container');
      
      for (let i = 0; i < pages.length; i++) {
        if (isExportCancelled) break;
        
        setExportProgress(Math.round(((i + 1) / pages.length) * 100));
        
        const canvas = await html2canvas(pages[i] as HTMLElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        });
        
        const link = document.createElement('a');
        link.download = `Page_${i + 1}_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
      
      if (!isExportCancelled) {
        message.success(`成功导出 ${pages.length} 张图片`);
      }
    } catch (error) {
      console.error('导出图片失败:', error);
      message.error('导出图片失败');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!isPaginated) return;
    
    setExportLoading(true);
    setExportType('PDF');
    setExportProgress(0);
    setIsExportCancelled(false);
    
    try {
      const { jsPDF } = await import('jspdf');
      const pages = document.querySelectorAll('.print-container');
      
      if (pages.length === 0) {
        message.error('没有找到可导出的页面');
        return;
      }
      
      const firstPage = pages[0] as HTMLElement;
      const pdfWidth = firstPage.offsetWidth;
      const pdfHeight = firstPage.offsetHeight;
      
      const pdf = new jsPDF({
        orientation: orientation === 'portrait' ? 'portrait' : 'landscape',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });
      
      for (let i = 0; i < pages.length; i++) {
        if (isExportCancelled) break;
        
        setExportProgress(Math.round(((i + 1) / pages.length) * 100));
        
        if (i > 0) {
          pdf.addPage([pdfWidth, pdfHeight]);
        }
        
        const canvas = await html2canvas(pages[i] as HTMLElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        });
        
        // 使用 JPEG 格式，质量 0.85，大幅减小 PDF 体积
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }
      
      if (!isExportCancelled) {
        pdf.save(`Table_${Date.now()}.pdf`);
        message.success('PDF导出成功');
      }
    } catch (error) {
      console.error('导出PDF失败:', error);
      message.error('导出PDF失败');
    } finally {
      setExportLoading(false);
    }
  };

  // 导出第一页为图片
  const handleExportFirstPageImage = async () => {
    if (!isPaginated) return;
    
    setExportLoading(true);
    setExportType('图片');
    setExportProgress(0);
    
    try {
      const pages = document.querySelectorAll('.print-container');
      if (pages.length === 0) {
        message.error('没有找到可导出的页面');
        return;
      }
      
      const canvas = await html2canvas(pages[0] as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `Page_1_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      message.success('第一页图片导出成功');
    } catch (error) {
      console.error('导出图片失败:', error);
      message.error('导出图片失败');
    } finally {
      setExportLoading(false);
    }
  };

  // 导出第一页为PDF
  const handleExportFirstPagePDF = async () => {
    if (!isPaginated) return;
    
    setExportLoading(true);
    setExportType('PDF');
    setExportProgress(0);
    
    try {
      const { jsPDF } = await import('jspdf');
      const pages = document.querySelectorAll('.print-container');
      
      if (pages.length === 0) {
        message.error('没有找到可导出的页面');
        return;
      }
      
      const firstPage = pages[0] as HTMLElement;
      const pdfWidth = firstPage.offsetWidth;
      const pdfHeight = firstPage.offsetHeight;
      
      const pdf = new jsPDF({
        orientation: orientation === 'portrait' ? 'portrait' : 'landscape',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });
      
      const canvas = await html2canvas(pages[0] as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false
      });
      
      // 使用 JPEG 格式，质量 0.85，大幅减小 PDF 体积
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      
      pdf.save(`Page_1_${Date.now()}.pdf`);
      message.success('第一页PDF导出成功');
    } catch (error) {
      console.error('导出PDF失败:', error);
      message.error('导出PDF失败');
    } finally {
      setExportLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!isPaginated) return;
    
    setExportLoading(true);
    setExportType('打印');
    setExportProgress(0);
    setIsExportCancelled(false);
    
    try {
      const { jsPDF } = await import('jspdf');
      const pages = document.querySelectorAll('.print-container');
      
      if (pages.length === 0) return;
      
      const firstPage = pages[0] as HTMLElement;
      const pdfWidth = firstPage.offsetWidth;
      const pdfHeight = firstPage.offsetHeight;
      
      const pdf = new jsPDF({
        orientation: orientation === 'portrait' ? 'portrait' : 'landscape',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });
      
      for (let i = 0; i < pages.length; i++) {
        if (isExportCancelled) break;
        
        setExportProgress(Math.round(((i + 1) / pages.length) * 100));
        
        if (i > 0) {
          pdf.addPage([pdfWidth, pdfHeight]);
        }
        
        const canvas = await html2canvas(pages[i] as HTMLElement, {
          backgroundColor: '#ffffff',
          scale: 1.5,
          useCORS: true,
          allowTaint: true
        });
        
        const imgData = canvas.toDataURL('image/png', 0.9);
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      if (!isExportCancelled) {
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        const printWindow = window.open(pdfUrl);
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
        
        message.success('打印文件已生成');
      }
    } catch (error) {
      console.error('打印失败:', error);
      message.error('打印失败');
    } finally {
      setExportLoading(false);
    }
  };

  const handleCancelExport = () => {
    setIsExportCancelled(true);
    setExportLoading(false);
    message.info('正在取消导出...');
  };

  // 渲染表格行
  const renderTableRow = (row: any, rowIndex: number, level: number = 0) => {
    const isChild = level > 0;
    
    return (
      <tr key={rowIndex}>
        {filteredColumns.map((column, colIndex) => {
          const value = row[column.field] || '';
          const isNumber = isNumeric(value);
          
          return (
            <td
              key={colIndex}
              style={{
                border: '0.5px solid #ddd',
                padding: `${cellPadding}px`,
                fontSize: `${fontSize}px`,
                whiteSpace: 'normal',
                wordBreak: 'break-all',
                overflowWrap: 'break-word',
                width: column.width || 150,
                minWidth: 50,
                overflow: 'visible',
                textAlign: isNumber ? 'right' : 'left',
                paddingLeft: (isChild && colIndex === 0) ? `${20 + level * 20}px` : `${cellPadding}px`,
              }}
            >
              {isChild && colIndex === 0 && (
                <span style={{ marginRight: '4px', color: '#999' }}>└─</span>
              )}
              {renderCell(row, column)}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="print-preview-wrapper">
      <div className="print-preview-toolbar">
        <div className="flex justify-between items-center mb-4">
          {isPaginated ? (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                type="default"
                icon={<CloseOutlined />}
                onClick={() => setIsPaginated(false)}
              >
                退出分页
              </Button>
              <Space wrap>
                <Button
                  type="default"
                  icon={<PictureOutlined />}
                  onClick={() => handleExportFirstPageImage()}
                >
                  导出第一张图片
                </Button>
                <Button
                  type="default"
                  icon={<PictureOutlined />}
                  onClick={handleExportImages}
                >
                  导出全部图片
                </Button>
                <Button
                  type="default"
                  icon={<FilePdfOutlined />}
                  onClick={() => handleExportFirstPagePDF()}
                >
                  导出第一页PDF
                </Button>
                <Button
                  type="default"
                  icon={<FilePdfOutlined />}
                  onClick={handleExportPDF}
                >
                  导出完整PDF
                </Button>
                <Button
                  type="primary"
                  icon={<PrinterOutlined />}
                  onClick={handlePrint}
                  style={{ backgroundColor: '#ff8e22', borderColor: '#ff8e22' }}
                >
                  打印
                </Button>
              </Space>
            </div>
          ) : (
            <Space wrap>
              <Input
                placeholder="输入标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: 300, textAlign: 'left' }}
              />
              <Space.Compact>
                <Button
                  type={orientation === 'portrait' ? 'primary' : 'default'}
                  onClick={() => setOrientation('portrait')}
                >
                  纵向
                </Button>
                <Button
                  type={orientation === 'landscape' ? 'primary' : 'default'}
                  onClick={() => setOrientation('landscape')}
                >
                  横向
                </Button>
              </Space.Compact>
              
              <Button onClick={() => setShowPaddingModal(true)}>
                内边距
              </Button>
              
              <Button onClick={() => setShowMarginModal(true)}>
                外边距
              </Button>
              
              <Select
                mode="multiple"
                placeholder="显示列"
                value={visibleColumns}
                onChange={setVisibleColumns}
                style={{ width: 200 }}
                options={columns.map(col => ({ label: col.headerName, value: col.field }))}
                maxTagCount={1}
              />
              
              <Select
                mode="multiple"
                placeholder="标签"
                value={tagColumns}
                onChange={setTagColumns}
                style={{ width: 150 }}
                options={columns.map(col => ({ label: col.headerName, value: col.field }))}
                maxTagCount={1}
              />
              
              <Select
                placeholder="父记录"
                value={parentColumn || undefined}
                onChange={setParentColumn}
                style={{ width: 150 }}
                options={[{ label: '无', value: '' }, ...columns.map(col => ({ label: col.headerName, value: col.field }))]}
                allowClear
              />
              
              <Select
                mode="multiple"
                placeholder="分组"
                value={groupColumns}
                onChange={setGroupColumns}
                style={{ width: 150 }}
                options={columns.map(col => ({ label: col.headerName, value: col.field }))}
                maxTagCount={1}
              />
              
              <Button
                type="default"
                icon={<FileDoneOutlined />}
                onClick={handleTogglePagination}
              >
                分页
              </Button>
            </Space>
          )}
        </div>
      </div>

      <div className="print-preview-content" style={{ overflow: 'auto', textAlign: 'left', maxHeight: 'calc(100vh - 200px)' }}>
        <div className="preview-container" style={{ overflow: 'visible', maxWidth: 'none', minWidth: 'fit-content', display: 'inline-block' }}>
          {isPaginated ? (
            // 分页状态 - 使用基于实际测量的 paginatedData
            (() => {
              // 如果 paginatedData 还没有准备好，显示加载状态
              if (!paginatedData || paginatedData.length === 0) {
                return (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '400px',
                    color: '#999'
                  }}>
                    正在计算分页...
                  </div>
                );
              }
              
              const previewContainer = document.querySelector('.preview-container');
              const tableElement = document.querySelector('.preview-container table');
              const containerWidth = previewContainer ? previewContainer.clientWidth : 800;
              const tableWidthActual = tableElement ? tableElement.scrollWidth : 0;
              const widthX = Math.max(containerWidth, tableWidthActual, 800);
              
              // A4 纸尺寸：210mm x 297mm
              const a4WidthPx = 210 * 3.7795;
              const a4HeightPx = 297 * 3.7795;
              const highthX = orientation === 'portrait' ? a4HeightPx : a4WidthPx;
              
              // 使用预计算的分页数据
              return paginatedData.map((pageData, pageIndex) => (
                <div 
                  key={pageIndex}
                  className={`print-container ${orientation}`}
                  style={{
                    margin: `${outerMargin}px`,
                    width: `${widthX}px`,
                    height: `${highthX}px`,
                    border: '0.5px solid #ddd',
                    padding: `${outerMargin}px`,
                    backgroundColor: 'white',
                    fontSize: `${fontSize}px`,
                    marginBottom: `${outerMargin}px`,
                    pageBreakInside: 'avoid',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  {/* 标题只在第一页显示 */}
                  {title && pageIndex === 0 && (
                    <h1 style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'left', marginBottom: '12px' }}>{title}</h1>
                  )}
                  
                  <div className="table-container" style={{ overflow: 'visible' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: `${fontSize}px`,
                      tableLayout: 'fixed'
                    }}>
                      <thead style={{ backgroundColor: '#f5f5f5' }}>
                        <tr>
                          {filteredColumns.map((column, idx) => (
                            <th
                              key={idx}
                              style={{
                                border: '0.5px solid #ddd',
                                padding: `${cellPadding}px`,
                                textAlign: isNumeric(column.headerName) ? 'right' : 'left',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                width: column.width || 150,
                                minWidth: 50,
                                cursor: 'default',
                              }}
                            >
                              {column.headerName}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageData.map((pageItem, idx) => {
                          if (pageItem.isGroup) {
                            return (
                              <tr key={`group-${idx}`}>
                                <td
                                  colSpan={filteredColumns.length}
                                  style={{
                                    border: '0.5px solid #ddd',
                                    padding: '8px',
                                    fontSize: `${fontSize}px`,
                                    fontWeight: 'bold',
                                    backgroundColor: '#f0f0f0',
                                    textAlign: 'left',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    paddingLeft: `${8 + pageItem.level * 4}px`,
                                  }}
                                >
                                  {renderGroupValue(pageItem.groupValue, pageItem.groupColumn)}
                                  <span style={{ marginLeft: '8px', color: '#999', fontWeight: 'normal' }}>({pageItem.count})</span>
                                </td>
                              </tr>
                            );
                          }
                          return renderTableRow(pageItem, idx, pageItem.level || 0);
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ));
            })()
          ) : (
            // 非分页状态
            // paper: 打印区域，宽度随table动态变化，无外部边距
            // table: 表格区域，宽度自适应
            // outerMargin: paper的padding，即table与paper之间的间距（外边距）
            (() => {
              // 计算table的总宽度（所有列宽之和）
              const tableWidth = filteredColumns.reduce((sum, col) => sum + (col.width || 150), 0);
              
              return (
                <div
                  ref={componentRef}
                  className="preview-single-page"
                  style={{
                    margin: '0px', // paper无外部边距，左侧与组件栏对齐
                    width: `${tableWidth + outerMargin * 2}px`, // paper宽度 = table宽度 + 左右padding
                    minWidth: 'auto',
                    minHeight: 'auto',
                    border: '0.5px solid #ddd',
                    padding: `${outerMargin}px`, // paper的padding作为table与paper的间距（外边距）
                    backgroundColor: 'white',
                    fontSize: `${fontSize}px`,
                    boxSizing: 'border-box',
                  }}
                >
                  {title && (
                    <h1 style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'left', marginBottom: '12px' }}>{title}</h1>
                  )}
                  
                  <div className="table-container" style={{ overflow: 'visible', width: `${tableWidth}px` }}>
                    <table style={{
                      borderCollapse: 'collapse',
                      fontSize: `${fontSize}px`,
                      width: `${tableWidth}px`, // table宽度自适应
                      tableLayout: 'fixed'
                    }}>
                  <thead style={{ backgroundColor: '#f5f5f5', position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      {filteredColumns.map((column, index) => (
                        <th
                          key={index}
                          style={{
                            border: '0.5px solid #ddd',
                            padding: `${cellPadding}px`,
                            textAlign: 'left',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            wordBreak: 'normal',
                            maxWidth: '1200px',
                            width: column.width || 150,
                            minWidth: 50,
                            cursor: 'col-resize',
                            position: 'relative',
                          }}
                        >
                          <span>{column.headerName}</span>
                          <div
                            style={{
                              position: 'absolute',
                              right: '0',
                              top: '0',
                              bottom: '0',
                              width: '10px',
                              cursor: 'col-resize',
                              backgroundColor: resizing?.index === index ? '#1890ff' : 'transparent',
                              transition: 'background-color 0.2s',
                              zIndex: 1,
                            }}
                            onMouseEnter={(e) => {
                              const target = e.currentTarget as HTMLElement;
                              if (!resizing) target.style.backgroundColor = 'rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                              const target = e.currentTarget as HTMLElement;
                              if (!resizing) target.style.backgroundColor = 'transparent';
                            }}
                            onMouseDown={(e) => handleMouseDown(e, index, e.currentTarget.parentElement as HTMLTableCellElement)}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {processedData.map((group, groupIndex) => (
                      <React.Fragment key={groupIndex}>
                        {group.isGroup ? (
                          // 分组行
                          <tr>
                            <td
                              colSpan={filteredColumns.length}
                              style={{
                                border: '0.5px solid #ddd',
                                padding: '8px',
                                fontSize: `${fontSize}px`,
                                fontWeight: 'bold',
                                backgroundColor: '#f0f0f0',
                                textAlign: 'left',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                paddingLeft: `${8 + group.level * 4}px`, // 第0级无缩进，第1级4px，第2级8px...
                              }}
                            >
                              {renderGroupValue(group.groupValue, group.groupColumn)}
                              <span style={{ marginLeft: '8px', color: '#999', fontWeight: 'normal' }}>({group.count})</span>
                            </td>
                          </tr>
                        ) : group.isData ? (
                          // 数据行
                          renderTableRow(group, groupIndex, 0)
                        ) : (
                          // 普通分组数据
                          buildTreeData(group.data).map((row, rowIndex) =>
                            renderTableRow(row, rowIndex, row.level)
                          )
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* 内边距设置弹窗 */}
      <Modal
        title="设置单元格内边距"
        open={showPaddingModal}
        onOk={() => setShowPaddingModal(false)}
        onCancel={() => setShowPaddingModal(false)}
      >
        <div style={{ padding: '20px 0' }}>
          <span>内边距: {cellPadding}px</span>
          <Slider
            min={4}
            max={20}
            value={cellPadding}
            onChange={setCellPadding}
          />
        </div>
      </Modal>

      {/* 外边距设置弹窗 */}
      <Modal
        title="设置外边距"
        open={showMarginModal}
        onOk={() => setShowMarginModal(false)}
        onCancel={() => setShowMarginModal(false)}
      >
        <div style={{ padding: '20px 0' }}>
          <span>外边距: {outerMargin}px</span>
          <Slider
            min={0}
            max={50}
            value={outerMargin}
            onChange={setOuterMargin}
          />
        </div>
      </Modal>

      {/* 导出Loading浮层 */}
      <Modal
        title={`正在导出${exportType}`}
        open={exportLoading}
        footer={[
          <Button key="cancel" onClick={handleCancelExport}>
            取消导出
          </Button>
        ]}
        closable={false}
        mask={{ closable: false }}
        width={400}
        style={{
          top: '50%',
          transform: 'translateY(-50%)'
        }}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px', fontSize: '16px', color: '#666' }}>
            正在导出...
          </div>
          <Progress
            percent={exportProgress}
            status={isExportCancelled ? 'exception' : 'active'}
            style={{ marginTop: '16px' }}
          />
        </div>
      </Modal>
      
      {/* 分页计算 Loading 浮层 */}
      {paginationLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px 48px',
              borderRadius: '8px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            <Spin size="large" style={{ marginBottom: '16px' }} />
            <div style={{ fontSize: '14px', color: '#666' }}>
              正在计算分页...
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              {paginationProgress}%
            </div>
            <Progress
              percent={paginationProgress}
              size="small"
              style={{ width: '200px', marginTop: '12px' }}
              showInfo={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintPreview;