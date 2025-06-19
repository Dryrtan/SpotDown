import * as React from 'react';

interface CountdownTimerProps {
  targetDate: Date;
}

export function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = React.useState<string>('');

  React.useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      
      if (difference <= 0) {
        setTimeLeft('Expirado');
        return;
      }
      
      // Cálculo de dias, horas, minutos e segundos
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      // Formatação da saída
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };
    
    // Calcula o tempo restante imediatamente
    calculateTimeLeft();
    
    // Atualiza a cada segundo
    const timerId = setInterval(calculateTimeLeft, 1000);
    
    // Limpa o intervalo quando o componente é desmontado
    return () => clearInterval(timerId);
  }, [targetDate]);
  
  return <span>{timeLeft}</span>;
}