from html import escape
import streamlit as st


def render_kpis(values):
    notes = [
        'Unique container / BL pairs', 'Status recorded as Delivered',
        'Status recorded as Pending', 'Delivered / total containers',
        'Pending past delivery target', 'Pending within warning window',
    ]
    tones = ['', 'ffm-green', '', 'ffm-green', 'ffm-red', 'ffm-amber']
    # Two rows of three keep labels readable on tablet widths.
    for start in (0, 3):
        for column, (label, value), note, tone in zip(
            st.columns(3), list(values.items())[start:start+3],
            notes[start:start+3], tones[start:start+3],
        ):
            with column:
                st.markdown(
                    f'<div class="ffm-card {tone}" title="{escape(note)}">'
                    f'<div class="ffm-card-label">{escape(label)}</div>'
                    f'<div class="ffm-card-value">{escape(str(value))}</div>'
                    f'<div class="ffm-card-note">{escape(note)}</div></div>',
                    unsafe_allow_html=True,
                )
