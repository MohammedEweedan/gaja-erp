import React, { useId } from "react";
import styled from "styled-components";
import { Brightness5 } from "@mui/icons-material";
import { DarkMode } from "@mui/icons-material";

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange }) => {
  const id = useId();

  return (
    <StyledWrapper>
      <div className="container">
        <input
          type="checkbox"
          className="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
        />
        <label className="switch" htmlFor={id}>
          <span className="slider" />
          <span className="icon icon--sun"><Brightness5 fontSize="inherit" /></span>
          <span className="icon icon--moon"><DarkMode fontSize="inherit" /></span>
        </label>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  /* Let the parent (header toolbar) control size */
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;

  .container {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Hide default checkbox */
  .checkbox {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  /* Track */
  .switch {
    position: relative;
    width: 52px;
    height: 28px;
    border-radius: 999px;
    background-color: #e9e9eb;
    cursor: pointer;
    transition: background-color 0.25s ease;
    display: inline-block;
  }

  /* Knob */
  .slider {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0px 3px 8px rgba(0, 0, 0, 0.15),
      0px 3px 1px rgba(0, 0, 0, 0.06);
    transition: transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
    will-change: transform;
  }

  /* Icons inside the track */
  .icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-size: 12px;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .icon--sun {
    left: 7px;
    opacity: 1; /* visible in light mode by default */
    color: #fbbf24;
  }

  .icon--moon {
    right: 7px;
    opacity: 0.3; /* dim in light mode */
    color: #e5e7eb;
  }

  /* Checked (dark mode) state */
  .checkbox:checked + .switch {
    /* match your dark mode accent / background */
    background-color: #151922;
  }

  .checkbox:checked + .switch .slider {
    /* Move knob to the right smoothly */
    transform: translateX(24px);
  }

  /* Toggle icon emphasis */
  .checkbox:checked + .switch .icon--sun {
    opacity: 0.3;
  }

  .checkbox:checked + .switch .icon--moon {
    opacity: 1;
  }
`;

export default Switch;
