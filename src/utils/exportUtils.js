// src/utils/exportUtils.js
// ─────────────────────────────────────────────────────────────
// Utilities for exporting tournament data to PDF and Excel
// ─────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Export fixtures (pool and knockout matches) to Excel
 */
export async function exportFixturesToExcel(matches, teams, tournamentName) {
  try {
    const poolMatches = matches.filter(m => m.type === 'pool');
    const knockoutMatches = matches.filter(m => m.type === 'knockout');

    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Pool Fixtures Sheet
    if (poolMatches.length > 0) {
      const poolData = poolMatches.map(m => ({
        'Pool': m.poolId || '-',
        'Round': m.round || '-',
        'Match #': m.matchNumber || '-',
        'Team A': m.teamAName || teamMap[m.teamAId]?.name || '-',
        'Score A': m.scoreA !== null ? m.scoreA : '-',
        'Score B': m.scoreB !== null ? m.scoreB : '-',
        'Team B': m.teamBName || teamMap[m.teamBId]?.name || '-',
        'Status': m.status || '-',
      }));

      const poolSheet = XLSX.utils.json_to_sheet(poolData);
      XLSX.utils.book_append_sheet(workbook, poolSheet, 'Pool Fixtures');
    }

    // Knockout Fixtures Sheet
    if (knockoutMatches.length > 0) {
      const knockoutData = knockoutMatches.map(m => ({
        'Stage': m.stage || '-',
        'Match #': m.matchNumber || '-',
        'Team A': m.teamAName || teamMap[m.teamAId]?.name || '-',
        'Score A': m.scoreA !== null ? m.scoreA : '-',
        'Score B': m.scoreB !== null ? m.scoreB : '-',
        'Team B': m.teamBName || teamMap[m.teamBId]?.name || '-',
        'Status': m.status || '-',
      }));

      const knockoutSheet = XLSX.utils.json_to_sheet(knockoutData);
      XLSX.utils.book_append_sheet(workbook, knockoutSheet, 'Knockout Fixtures');
    }

    // Write file
    XLSX.writeFile(workbook, `${tournamentName}_Fixtures.xlsx`);
  } catch (err) {
    console.error('Error exporting fixtures to Excel:', err);
    throw err;
  }
}

/**
 * Export leaderboard standings to Excel
 */
export async function exportLeaderboardToExcel(leaderboard, teams, pools, tournamentName) {
  try {
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const workbook = XLSX.utils.book_new();

    // Create a sheet for each pool
    pools.forEach(pool => {
      const poolData = leaderboard
        .filter(lb => lb.poolId === pool)
        .sort((a, b) => {
          const pointsA = a.points || 0;
          const pointsB = b.points || 0;
          if (pointsA !== pointsB) return pointsB - pointsA;
          const gdA = a.gd || 0;
          const gdB = b.gd || 0;
          if (gdA !== gdB) return gdB - gdA;
          return (b.gf || 0) - (a.gf || 0);
        })
        .map((lb, index) => ({
          'Rank': index + 1,
          'Team': teamMap[lb.teamId]?.name || '-',
          'Played': lb.played || 0,
          'Won': lb.won || 0,
          'Drawn': lb.drawn || 0,
          'Lost': lb.lost || 0,
          'GF': lb.gf || 0,
          'GA': lb.ga || 0,
          'GD': lb.gd || 0,
          'Points': lb.points || 0,
        }));

      if (poolData.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(poolData);
        XLSX.utils.book_append_sheet(workbook, sheet, `Pool ${pool}`);
      }
    });

    XLSX.writeFile(workbook, `${tournamentName}_Leaderboard.xlsx`);
  } catch (err) {
    console.error('Error exporting leaderboard to Excel:', err);
    throw err;
  }
}

/**
 * Export all matches results to Excel
 */
export async function exportMatchesToExcel(matches, teams, tournamentName) {
  try {
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
    
    const allMatches = matches.map(m => ({
      'Type': m.type === 'pool' ? 'Pool' : 'Knockout',
      'Match #': m.matchNumber || '-',
      'Stage/Pool': m.stage || m.poolId || '-',
      'Round': m.round || '-',
      'Team A': m.teamAName || teamMap[m.teamAId]?.name || '-',
      'Score A': m.scoreA !== null ? m.scoreA : '-',
      'Score B': m.scoreB !== null ? m.scoreB : '-',
      'Team B': m.teamBName || teamMap[m.teamBId]?.name || '-',
      'Status': m.status || '-',
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(allMatches);
    XLSX.utils.book_append_sheet(workbook, sheet, 'All Matches');

    XLSX.writeFile(workbook, `${tournamentName}_Matches.xlsx`);
  } catch (err) {
    console.error('Error exporting matches to Excel:', err);
    throw err;
  }
}

/**
 * Export HTML element to PDF
 */
export async function exportTablesToPDF(elementId, fileName, pageLabel) {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID ${elementId} not found`);
    }

    // Make element visible temporarily for capture
    const originalDisplay = element.style.display;
    element.style.display = 'block';
    element.style.position = 'static';
    element.style.visibility = 'visible';

    // Add a small delay to ensure rendering is complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      isElementHeightKnown: false,
      windowHeight: element.scrollHeight
    });

    // Restore original display
    element.style.display = originalDisplay;

    if (!canvas) {
      throw new Error('Failed to create canvas from element');
    }

    // Convert canvas to image data URL
    let imgData;
    try {
      imgData = canvas.toDataURL('image/jpeg', 0.95);
    } catch (e) {
      // Fallback to PNG if JPEG fails
      imgData = canvas.toDataURL('image/png');
    }

    if (!imgData || imgData === 'data:,') {
      throw new Error('Canvas conversion resulted in empty data');
    }

    // Create PDF with appropriate orientation
    const pdfWidth = canvas.width;
    const pdfHeight = canvas.height;
    const orientation = pdfWidth > pdfHeight ? 'landscape' : 'portrait';
    
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'px',
      format: [pdfWidth, pdfHeight]
    });

    // Add image to PDF
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

    pdf.save(`${fileName}_${pageLabel}.pdf`);
  } catch (err) {
    console.error('Error exporting to PDF:', err);
    throw err;
  }
}

/**
 * Export fixtures tables to PDF
 */
export async function exportFixturesToPDF(fileName) {
  try {
    await exportTablesToPDF('fixtures-export-section', fileName, 'Fixtures');
  } catch (err) {
    console.error('Error exporting fixtures to PDF:', err);
    throw err;
  }
}

/**
 * Export leaderboard table to PDF
 */
export async function exportLeaderboardToPDF(fileName) {
  try {
    await exportTablesToPDF('leaderboard-export-section', fileName, 'Leaderboard');
  } catch (err) {
    console.error('Error exporting leaderboard to PDF:', err);
    throw err;
  }
}

/**
 * Export matches table to PDF
 */
export async function exportMatchesToPDF(fileName) {
  try {
    await exportTablesToPDF('matches-export-section', fileName, 'Matches');
  } catch (err) {
    console.error('Error exporting matches to PDF:', err);
    throw err;
  }
}
