// src/utils/exportUtils.js
// ─────────────────────────────────────────────────────────────
// Utilities for exporting tournament data to PDF and Excel
// ─────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ═════════════════════════════════════════════════════════════
// CONSTANTS & TEMPLATES
// ═════════════════════════════════════════════════════════════

const RULES_AND_REGULATIONS = [
  'Matches will be played at University Grounds, Tumakuru',
  'Matches will be announced 15 Minutes prior only.',
  'All Teams shall be present at the venue and shall be ready to play more than a match in a session with 15 minute advance intimation.',
  'Matches will be played as per court availability, outdoor in day light.',
  'All league matches will be played with 20-05 min 20 minutes and Knock-outs will be played with 25-05-25 minutes.',
  'No protests shall be entertained against the decision of the referees. If a team walks out against the decision of the referee when the match is in progress, then the defaulting district association will be banned from all activities by the KHA for a period of 2 years from the date of the incident.',
  'If any player/official misbehaves on & off the field, the concerned team shall be disqualified and will be debarred for minimum of 2 years.',
  'Lastest Rules of IHF as approved by the Handball Association India shall be followed.',
  'The teams shall carry their own serviceable ball.',
  'The Organizers shall have the right to pre-pone or post-pone the matches.',
  'Jersey numbers of the players will be retained till the last playable match.',
  'Only Registered players with the State Association through online shall only be allowed to participate in the championship.',
  'All Managers and Coaches shall be responsible and accountable for their team\'s discipline at all times.'
];

const FOOTER_SIGNATURE = {
  name: 'B. L. Lokesha',
  designation: 'Organizing Secretary and Competition Director'
};

// ═════════════════════════════════════════════════════════════
// NOTE: Helper functions (buildExcelHeader, buildExcelFooter) kept for future use
// Currently simplified exports do not use them

/**
 * Export fixtures (pool and knockout matches) to Excel - With Semi-Final & Final sections
 */
export async function exportFixturesToExcel(matches, teams, tournamentName) {
  try {
    const poolMatches = matches.filter(m => m.type === 'pool');
    const knockoutMatches = matches.filter(m => m.type === 'knockout');
    const semiFinalsMatches = knockoutMatches.filter(m => m.stage === 'SF');
    const finalMatches = knockoutMatches.filter(m => m.stage === 'Final');

    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // ── POOL FIXTURES SHEET ──
    if (poolMatches.length > 0) {
      const poolData = poolMatches
        .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0))
        .map(m => ({
          'Match No': m.matchNumber || '-',
          'Team 1': m.teamAName || teamMap[m.teamAId]?.name || '-',
          'Vs': 'V/s',
          'Team 2': m.teamBName || teamMap[m.teamBId]?.name || '-',
          'Pool': m.poolId || '-',
        }));

      const poolSheet = XLSX.utils.json_to_sheet(poolData);
      poolSheet['!cols'] = [
        { wch: 10 }, { wch: 25 }, { wch: 5 }, { wch: 25 }, { wch: 10 }
      ];
      XLSX.utils.book_append_sheet(workbook, poolSheet, 'Pool Fixtures');
    }

    // ── SEMI-FINAL & FINAL SHEET ──
    const knockoutSheet = XLSX.utils.json_to_sheet([]);
    let rowNum = 0;

    // Add Semi-Finals section
    if (semiFinalsMatches.length > 0) {
      // Section title
      const titleCell = XLSX.utils.encode_cell({ r: rowNum, c: 0 });
      knockoutSheet[titleCell] = { v: 'Semi-Final Match Schedule', t: 's' };
      rowNum++;

      // Headers
      const headers = ['Match No', 'Team 1', 'Vs', 'Team 2'];
      headers.forEach((header, col) => {
        const cell = XLSX.utils.encode_cell({ r: rowNum, c: col });
        knockoutSheet[cell] = { v: header, t: 's' };
      });
      rowNum++;

      // Semi-final matches
      semiFinalsMatches
        .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0))
        .forEach(m => {
          const matchData = [
            m.matchNumber || '-',
            m.teamAName || teamMap[m.teamAId]?.name || '-',
            'V/s',
            m.teamBName || teamMap[m.teamBId]?.name || '-'
          ];
          matchData.forEach((val, col) => {
            const cell = XLSX.utils.encode_cell({ r: rowNum, c: col });
            knockoutSheet[cell] = { v: val, t: 's' };
          });
          rowNum++;
        });

      rowNum++; // Blank row
    }

    // Add Finals section
    if (finalMatches.length > 0) {
      // Section title
      const titleCell = XLSX.utils.encode_cell({ r: rowNum, c: 0 });
      knockoutSheet[titleCell] = { v: 'Final Match Schedule', t: 's' };
      rowNum++;

      // Headers
      const headers = ['Match No', 'Team 1', 'Vs', 'Team 2'];
      headers.forEach((header, col) => {
        const cell = XLSX.utils.encode_cell({ r: rowNum, c: col });
        knockoutSheet[cell] = { v: header, t: 's' };
      });
      rowNum++;

      // Final matches
      finalMatches
        .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0))
        .forEach(m => {
          const matchData = [
            m.matchNumber || '-',
            m.teamAName || teamMap[m.teamAId]?.name || '-',
            'V/s',
            m.teamBName || teamMap[m.teamBId]?.name || '-'
          ];
          matchData.forEach((val, col) => {
            const cell = XLSX.utils.encode_cell({ r: rowNum, c: col });
            knockoutSheet[cell] = { v: val, t: 's' };
          });
          rowNum++;
        });
    }

    knockoutSheet['!cols'] = [
      { wch: 10 }, { wch: 25 }, { wch: 5 }, { wch: 25 }
    ];

    if (semiFinalsMatches.length > 0 || finalMatches.length > 0) {
      XLSX.utils.book_append_sheet(workbook, knockoutSheet, 'Semi-Final & Final');
    }

    // Write file
    XLSX.writeFile(workbook, `${tournamentName}_Fixtures.xlsx`);
  } catch (err) {
    console.error('Error exporting fixtures to Excel:', err);
    throw err;
  }
}

/**
 * Export leaderboard standings to Excel - Simple format
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
        sheet['!cols'] = [
          { wch: 8 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, 
          { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 8 }
        ];
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
 * Simple export - Just Match No, Team 1, Vs, Team 2, Pool - sorted by match number
 */
export async function exportMatchesToExcel(matches, teams, tournamentName) {
  try {
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
    
    // Sort by match number and format data
    const sortedMatches = matches
      .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0))
      .map(m => ({
        'Match No': m.matchNumber || '-',
        'Team 1': m.teamAName || teamMap[m.teamAId]?.name || '-',
        'Vs': 'V/s',
        'Team 2': m.teamBName || teamMap[m.teamBId]?.name || '-',
        'Pool': m.poolId || m.stage || '-',
      }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(sortedMatches);
    
    // Set column widths
    sheet['!cols'] = [
      { wch: 10 }, // Match No
      { wch: 25 }, // Team 1
      { wch: 5 },  // Vs
      { wch: 25 }, // Team 2
      { wch: 10 }  // Pool
    ];

    XLSX.utils.book_append_sheet(workbook, sheet, 'Matches');
    XLSX.writeFile(workbook, `${tournamentName}_Matches.xlsx`);
  } catch (err) {
    console.error('Error exporting matches to Excel:', err);
    throw err;
  }
}

/**
 * Generate styled HTML for Semi-Final & Final matches (for PDF)
 */
export function generateKnockoutHTML(matches, teams) {
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const semiFinalsMatches = matches.filter(m => m.type === 'knockout' && m.stage === 'SF').sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
  const finalMatches = matches.filter(m => m.type === 'knockout' && m.stage === 'Final').sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

  let html = '<div style="margin-top: 30px;">';

  // Semi-Final section
  if (semiFinalsMatches.length > 0) {
    html += `
      <h3 style="text-align: center; margin: 20px 0; font-size: 16px; font-weight: bold; text-decoration: underline;">Semi-Final Match Schedule</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background-color: #ffeb3b; border: 1px solid #000;">
            <th style="padding: 8px; border: 1px solid #000; font-weight: bold;">Match No</th>
            <th style="padding: 8px; border: 1px solid #000; font-weight: bold;">Team 1</th>
            <th style="padding: 8px; border: 1px solid #000; font-weight: bold;">V/s</th>
            <th style="padding: 8px; border: 1px solid #000; font-weight: bold;">Team 2</th>
          </tr>
        </thead>
        <tbody>
    `;

    semiFinalsMatches.forEach((m, idx) => {
      const bgColor = idx % 2 === 0 ? '#ffeb3b' : '#ffc107'; // Yellow/Orange alternating
      html += `
        <tr style="background-color: ${bgColor}; border: 1px solid #000;">
          <td style="padding: 8px; border: 1px solid #000; text-align: center;">${m.matchNumber || '-'}</td>
          <td style="padding: 8px; border: 1px solid #000;">${m.teamAName || teamMap[m.teamAId]?.name || '-'}</td>
          <td style="padding: 8px; border: 1px solid #000; text-align: center;">V/s</td>
          <td style="padding: 8px; border: 1px solid #000;">${m.teamBName || teamMap[m.teamBId]?.name || '-'}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
  }

  // Final section
  if (finalMatches.length > 0) {
    html += `
      <h3 style="text-align: center; margin: 20px 0; font-size: 16px; font-weight: bold; text-decoration: underline;">Final Match Schedule</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #ffeb3b; border: 1px solid #000;">
            <th style="padding: 8px; border: 1px solid #000; font-weight: bold;">Match No</th>
            <th style="padding: 8px; border: 1px solid #000; font-weight: bold;">Team 1</th>
            <th style="padding: 8px; border: 1px solid #000; font-weight: bold;">V/s</th>
            <th style="padding: 8px; border: 1px solid #000; font-weight: bold;">Team 2</th>
          </tr>
        </thead>
        <tbody>
    `;

    finalMatches.forEach((m, idx) => {
      const bgColor = idx % 2 === 0 ? '#ffeb3b' : '#ffc107'; // Yellow/Orange alternating
      html += `
        <tr style="background-color: ${bgColor}; border: 1px solid #000;">
          <td style="padding: 8px; border: 1px solid #000; text-align: center;">${m.matchNumber || '-'}</td>
          <td style="padding: 8px; border: 1px solid #000;">${m.teamAName || teamMap[m.teamAId]?.name || '-'}</td>
          <td style="padding: 8px; border: 1px solid #000; text-align: center;">V/s</td>
          <td style="padding: 8px; border: 1px solid #000;">${m.teamBName || teamMap[m.teamBId]?.name || '-'}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
  }

  html += '</div>';
  return html;
}

export function generateExportHeader(tournamentName, organizationInfo = {}) {
  const { organizedBy = '', dates = '', venue = '' } = organizationInfo;
  
  return `
    <div style="page-break-inside: avoid; margin-bottom: 20px; border-bottom: 2px solid #000;">
      <div style="text-align: center; margin-bottom: 10px;">
        <h1 style="margin: 5px 0; font-size: 18px; font-weight: bold;">KARNATAKA HANDBALL ASSOCIATION (R)</h1>
        <h2 style="margin: 5px 0; font-size: 16px; font-weight: bold;">${tournamentName}</h2>
        ${organizedBy ? `<p style="margin: 3px 0; font-size: 12px;"><strong>Organized by:</strong> ${organizedBy}</p>` : ''}
        ${dates ? `<p style="margin: 3px 0; font-size: 12px;">${dates}</p>` : ''}
        ${venue ? `<p style="margin: 3px 0; font-size: 12px;"><strong>VENUE:</strong> ${venue}</p>` : ''}
      </div>
    </div>
  `;
}

/**
 * Generate HTML footer with rules and regulations
 */
export function generateExportFooter() {
  const rulesHTML = RULES_AND_REGULATIONS
    .map((rule, index) => `<p style="margin: 3px 0; font-size: 11px;">${index + 1}. ${rule}</p>`)
    .join('');

  return `
    <div style="page-break-inside: avoid; margin-top: 20px; border-top: 2px solid #000; padding-top: 10px;">
      <h3 style="margin: 5px 0; font-size: 12px; font-weight: bold;">Rules & Regulations:</h3>
      ${rulesHTML}
      <div style="margin-top: 20px; text-align: center;">
        <p style="margin: 3px 0; font-size: 12px; font-weight: bold;">${FOOTER_SIGNATURE.name}</p>
        <p style="margin: 3px 0; font-size: 11px;">${FOOTER_SIGNATURE.designation}</p>
      </div>
    </div>
  `;
}

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
