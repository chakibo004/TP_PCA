import React, { useRef, useEffect } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, disabled }) => {
  const inputsRef = useRef<HTMLInputElement[]>([]);

  // Focus sur la première case au montage
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Quand l’utilisateur tape un chiffre, on met à jour et on passe au suivant
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    idx: number
  ) => {
    const char = e.target.value.replace(/[^0-9]/g, "").slice(-1);
    const newVal = value.split("");
    newVal[idx] = char;
    onChange(newVal.join(""));
    if (char && inputsRef.current[idx + 1]) {
      inputsRef.current[idx + 1].focus();
    }
  };

  // Gestion du backspace pour revenir en arrière
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) => {
    if (e.key === "Backspace" && !value[idx] && inputsRef.current[idx - 1]) {
      const newVal = value.split("");
      newVal[idx - 1] = "";
      onChange(newVal.join(""));
      inputsRef.current[idx - 1].focus();
      e.preventDefault();
    }
  };

  return (
    <div className="flex justify-center space-x-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => {
            if (el) inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          disabled={disabled}
          className={`
            w-12 h-12 text-center text-xl font-bold
            border-2 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-teal-500
            transition-colors
            ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}
          `}
        />
      ))}
    </div>
  );
};

export default OtpInput;
